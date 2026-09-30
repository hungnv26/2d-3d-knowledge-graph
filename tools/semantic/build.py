#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["numpy>=1.26", "umap-learn>=0.5.6"]
# ///
"""Build the 3D Semantic Graph's data from a folder of Markdown notes.

2D-3D Knowledge Graph Package, by Hung Ngo (MIT).

Embeds every note (Ollama by default, or any OpenAI-compatible embeddings
endpoint), projects the vectors to 3D with UMAP (PCA for tiny folders),
clusters them with seeded k-means, names each cluster from its notes' tags, and
writes one JSON file the page reads with createStaticSemantic():

    {"built_at", "model", "nodes": [...], "clusters": [...], "links": [...],
     "vectors": {"dims", "encoding": "int8-base64", "data"}}

Each node carries id (path relative to the folder), label, path, folder, tags,
x/y/z, cluster, degree, plus any front matter fields named with --fields (for
example status and year, to colour by them). "vectors" holds every note's
embedding reduced with PCA and stored as int8, so "closest notes" and search
work in the browser with no server.

Usage:
    uv run tools/semantic/build.py <notes-folder> --out semantic.json [--fields status,year]
    uv run tools/semantic/build.py notes --provider openai --api-base https://api.example.com/v1 \
        --model text-embedding-3-small   # key read from EMBEDDINGS_API_KEY

Note text goes only to the embeddings endpoint you choose. It is never written
to the output file.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.request
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "bge-m3"
DEFAULT_SEED = 42
DEFAULT_VECTOR_DIMS = 256

MAX_TEXT_CHARS = 3000
MIN_BODY_CHARS = 40
MAX_FILE_BYTES = 400_000
EMBED_BATCH = 16
EMBED_TIMEOUT_SECONDS = 300

UMAP_MIN_NOTES = 6
UMAP_MAX_NEIGHBORS = 40
UMAP_MIN_DIST = 0.8
COORD_SCALE = 100.0
KMEANS_MIN, KMEANS_MAX = 4, 24
KMEANS_N_INIT = 4
KMEANS_MAX_ITER = 60
LABEL_TERMS = 3
MIN_NOTES_PER_TERM = 3
SEMANTIC_NEIGHBOURS = 4

SKIP_DIRS = {"node_modules", "graphify-out"}
WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]")
FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n?", re.DOTALL)
TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)
STOP_WORDS = frozenset({
    "a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "by", "for", "with", "from", "into",
    "about", "as", "is", "are", "was", "be", "vs", "per", "not", "no", "new", "how", "why", "what",
    "when", "your", "you", "that", "this", "summary", "overview", "note", "notes", "index",
})


class BuildError(Exception):
    """The build cannot proceed (no notes, embeddings endpoint unreachable, ...)."""


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def say(line: str) -> None:
    print(line, file=sys.stderr, flush=True)


# ----------------------------------------------------------------- corpus


def corpus_files(root: Path) -> list[Path]:
    out = []
    for p in sorted(root.rglob("*.md")):
        rel = p.relative_to(root)
        if any(part.startswith(".") or part in SKIP_DIRS for part in rel.parts):
            continue
        out.append(p)
    return out


def parse_note(text: str) -> tuple[str, list[str], dict, str]:
    """``(title, tags, front matter fields, body)``."""
    title, tags, fields, body = "", [], {}, text
    m = FRONTMATTER_RE.match(text)
    if m:
        fm = m.group(1)
        body = text[m.end():]
        for line in fm.splitlines():
            kv = re.match(r"^([A-Za-z_][\w-]*):\s*(.+?)\s*$", line)
            if kv and not kv.group(2).startswith("["):
                fields[kv.group(1)] = kv.group(2).strip("\"'")
        title = fields.get("title", "")
        inline = re.search(r"^tags:\s*\[(.*?)\]", fm, re.MULTILINE)
        if inline:
            tags = [x.strip().strip("\"'").lstrip("#") for x in inline.group(1).split(",")]
        else:
            block = re.search(r"^tags:\s*\n((?:\s+-\s+.*\n?)+)", fm, re.MULTILINE)
            if block:
                tags = [x.strip()[1:].strip().strip("\"'").lstrip("#") for x in block.group(1).splitlines() if x.strip()]
    if not title:
        h = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
        title = h.group(1).strip() if h else ""
    return title, [t for t in tags if t], fields, body


def scan(root: Path, keep_fields: list[str]) -> tuple[list[dict], dict[str, str]]:
    notes, raw_by_id = [], {}
    for p in corpus_files(root):
        try:
            if p.stat().st_size > MAX_FILE_BYTES:
                continue
            raw = p.read_text(encoding="utf-8", errors="replace").replace("\r", "")
        except OSError:
            continue
        rel = p.relative_to(root).as_posix()
        raw_by_id[rel] = raw
        title, tags, fields, body = parse_note(raw)
        text = body.strip()
        if len(text) < MIN_BODY_CHARS:
            continue
        label = title or p.stem
        # The title leads the embedded text so short notes still land near their topic.
        embed_text = f"{label}\n\n{text}"[:MAX_TEXT_CHARS]
        extra = {}
        for f in keep_fields:
            v = fields.get(f)
            if v is not None:
                extra[f] = int(v) if re.fullmatch(r"-?\d+", v) else v
        notes.append({
            "id": rel, "label": label, "folder": rel.split("/")[0] if "/" in rel else "root",
            "tags": tags, "text": embed_text, "extra": extra,
            "hash": hashlib.sha1(embed_text.encode("utf-8")).hexdigest(),
        })
    notes.sort(key=lambda n: n["id"])
    return notes, raw_by_id


def wikilinks(notes: list[dict], raw_by_id: dict[str, str]) -> tuple[list[tuple[str, str]], dict[str, int]]:
    ids = {n["id"] for n in notes}
    by_name: dict[str, str] = {}
    for rel in sorted(raw_by_id):
        by_name.setdefault(Path(rel).stem.lower(), rel)
    seen: set[tuple[str, str]] = set()
    degree = {i: 0 for i in ids}
    for src in sorted(ids):
        for m in WIKILINK_RE.finditer(raw_by_id.get(src, "")):
            tgt = by_name.get(m.group(1).split("/")[-1].strip().lower())
            if not tgt or tgt == src or tgt not in ids:
                continue
            key = (src, tgt) if src < tgt else (tgt, src)
            if key in seen:
                continue
            seen.add(key)
            degree[src] += 1
            degree[tgt] += 1
    return sorted(seen), degree


# -------------------------------------------------------------- embedding


def post_json(url: str, body: dict, headers: dict) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json", **headers}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=EMBED_TIMEOUT_SECONDS) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        raise BuildError(f"the embeddings endpoint answered HTTP {exc.code}") from exc
    except (urllib.error.URLError, OSError, TimeoutError, ValueError) as exc:
        raise BuildError(f"the embeddings endpoint is unreachable at {url}: {exc.__class__.__name__}") from exc


def embed_texts(args, texts: list[str]) -> list[list[float]]:
    if args.provider == "ollama":
        data = post_json(f"{args.ollama.rstrip('/')}/api/embed", {"model": args.model, "input": texts}, {})
        vectors = data.get("embeddings") if isinstance(data, dict) else None
    else:
        key = os.environ.get("EMBEDDINGS_API_KEY", "")
        data = post_json(f"{args.api_base.rstrip('/')}/embeddings", {"model": args.model, "input": texts},
                         {"Authorization": f"Bearer {key}"} if key else {})
        vectors = [d.get("embedding") for d in data.get("data", [])] if isinstance(data, dict) else None
    if not isinstance(vectors, list) or len(vectors) != len(texts):
        raise BuildError("the embeddings endpoint returned a malformed response")
    return vectors


def normalise(m: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return (m / norms).astype(np.float32)


def embed_corpus(notes: list[dict], args) -> np.ndarray:
    cache_file = Path(args.cache) if args.cache else None
    cached: dict[str, list[float]] = {}
    if cache_file and cache_file.exists():
        try:
            c = json.loads(cache_file.read_text(encoding="utf-8"))
            if c.get("model") == args.model:
                cached = c.get("vectors", {})
        except (OSError, ValueError):
            cached = {}
    todo = [n for n in notes if n["hash"] not in cached]
    say(f"{len(notes) - len(todo)} vectors reused, {len(todo)} notes to embed")
    for start in range(0, len(todo), EMBED_BATCH):
        batch = todo[start:start + EMBED_BATCH]
        for note, vec in zip(batch, embed_texts(args, [n["text"] for n in batch])):
            cached[note["hash"]] = vec
        say(f"embedded {min(start + EMBED_BATCH, len(todo))}/{len(todo)}")
    if cache_file:
        keep = {n["hash"] for n in notes}
        cache_file.write_text(json.dumps({"model": args.model, "vectors": {h: v for h, v in cached.items() if h in keep}}))
    return normalise(np.asarray([cached[n["hash"]] for n in notes], dtype=np.float32))


# -------------------------------------------------------------- projection


def pca(x: np.ndarray, k: int) -> np.ndarray:
    centred = x - x.mean(axis=0, keepdims=True)
    out = np.zeros((len(x), k), dtype=np.float64)
    if len(x) < 2:
        return out
    _, _, vt = np.linalg.svd(centred, full_matrices=False)
    k2 = min(k, vt.shape[0])
    out[:, :k2] = centred @ vt[:k2].T
    return out


def scale_coords(coords: np.ndarray) -> np.ndarray:
    centred = coords - coords.mean(axis=0, keepdims=True)
    extent = float(np.abs(centred).max()) if centred.size else 0.0
    return centred * (COORD_SCALE / extent) if extent > 0 else centred


def project_3d(vectors: np.ndarray, seed: int) -> np.ndarray:
    n = len(vectors)
    if n < UMAP_MIN_NOTES:
        return scale_coords(pca(vectors.astype(np.float64), 3))
    import umap  # slow import (numba)

    reducer = umap.UMAP(n_components=3, n_neighbors=min(UMAP_MAX_NEIGHBORS, n - 1),
                        min_dist=UMAP_MIN_DIST, metric="cosine", random_state=seed)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        coords = reducer.fit_transform(vectors)
    return scale_coords(np.asarray(coords, dtype=np.float64))


def pack_vectors(vectors: np.ndarray, dims: int) -> dict:
    """PCA to at most `dims`, unit length again, then int8: small enough to ship with the page."""
    reduced = pca(vectors.astype(np.float64), min(dims, vectors.shape[1], max(1, len(vectors) - 1)))
    reduced = normalise(reduced.astype(np.float32))
    q = np.clip(np.round(reduced * 127), -127, 127).astype(np.int8)
    return {"dims": int(q.shape[1]), "encoding": "int8-base64", "data": base64.b64encode(q.tobytes()).decode("ascii")}


# -------------------------------------------------------------- clustering


def cluster_count(n: int) -> int:
    return max(1, min(n, max(KMEANS_MIN, min(KMEANS_MAX, round(math.sqrt(n / 2))))))


def kmeans(x: np.ndarray, k: int, seed: int) -> np.ndarray:
    """Seeded k-means++ on unit vectors; best of KMEANS_N_INIT runs by inertia."""
    if k <= 1 or len(x) <= k:
        return np.arange(len(x)) % max(1, k)
    rng = np.random.default_rng(seed)
    best_labels, best_inertia = None, float("inf")
    for _ in range(KMEANS_N_INIT):
        centres = [x[rng.integers(len(x))]]
        d2 = np.full(len(x), np.inf)
        for _ in range(1, k):
            d2 = np.minimum(d2, ((x - centres[-1]) ** 2).sum(axis=1))
            total = d2.sum()
            centres.append(x[rng.choice(len(x), p=d2 / total)] if total > 0 else x[rng.integers(len(x))])
        c = np.stack(centres)
        labels = np.zeros(len(x), dtype=np.int64)
        for it in range(KMEANS_MAX_ITER):
            dist = (x * x).sum(axis=1)[:, None] - 2 * x @ c.T + (c * c).sum(axis=1)[None, :]
            new = dist.argmin(axis=1)
            if it and np.array_equal(new, labels):
                break
            labels = new
            for j in range(k):
                members = x[labels == j]
                c[j] = members.mean(axis=0) if len(members) else x[rng.integers(len(x))]
        inertia = float(((x - c[labels]) ** 2).sum())
        if inertia < best_inertia:
            best_labels, best_inertia = labels.copy(), inertia
    order = [c for c, _ in Counter(best_labels.tolist()).most_common()]
    remap = {old: new for new, old in enumerate(order)}
    return np.array([remap[int(v)] for v in best_labels], dtype=np.int64)


def label_clusters(groups: list[list[dict]]) -> list[str]:
    """Up to three distinctive tags per cluster, falling back to title words, then the folder."""
    note_terms = lambda n: [t.lower().strip() for t in n["tags"] if t.lower().strip() not in STOP_WORDS]
    title_terms = lambda n: [t for t in TOKEN_RE.findall(n["label"].lower()) if t.isalpha() and len(t) >= 4 and t not in STOP_WORDS]
    total = sum(len(g) for g in groups) or 1
    labels: list[str] = []
    for source in (note_terms, title_terms):
        global_counts = Counter(t for g in groups for n in g for t in set(source(n)))
        for gi, g in enumerate(groups):
            if gi < len(labels) and labels[gi]:
                continue
            local = Counter(t for n in g for t in set(source(n)))
            scored = sorted(((c / len(g)) * math.log(1 + total / global_counts[t]), t)
                            for t, c in local.items() if c >= min(MIN_NOTES_PER_TERM, len(g)))
            text = " · ".join([t for _, t in reversed(scored)][:LABEL_TERMS])
            if gi < len(labels):
                labels[gi] = text
            else:
                labels.append(text)
    for gi, g in enumerate(groups):
        if not labels[gi]:
            common = Counter(n["folder"] for n in g).most_common(1)
            labels[gi] = common[0][0] if common else "unlabelled"
    return labels


# -------------------------------------------------------------------- main


def build(args) -> dict:
    root = Path(args.notes).expanduser().resolve()
    if not root.is_dir():
        raise BuildError(f"{root} is not a folder")
    fields = [f.strip() for f in (args.fields or "").split(",") if f.strip()]
    say("scanning notes")
    notes, raw_by_id = scan(root, fields)
    if not notes:
        raise BuildError("no notes to embed")
    vectors = embed_corpus(notes, args)
    say(f"projecting {len(notes)} notes to 3D")
    coords = project_3d(vectors, args.seed)
    k = cluster_count(len(notes))
    say(f"clustering into {k} groups")
    assign = kmeans(vectors.astype(np.float64), k, args.seed)
    groups: list[list[dict]] = [[] for _ in range(int(assign.max()) + 1)]
    for n, c in zip(notes, assign):
        groups[int(c)].append(n)
    labels = label_clusters(groups)
    pairs, degree = wikilinks(notes, raw_by_id)
    # Notes with no links still get their closest neighbours in meaning, so nothing floats alone.
    sims = vectors @ vectors.T
    seen = set(pairs)
    for i, n in enumerate(notes):
        if degree[n["id"]]:
            continue
        for j in np.argsort(-sims[i])[1:SEMANTIC_NEIGHBOURS + 1]:
            a, b = sorted((n["id"], notes[int(j)]["id"]))
            if (a, b) not in seen:
                seen.add((a, b))
    clusters = []
    for ci, g in enumerate(groups):
        rows = [i for i, c in enumerate(assign) if int(c) == ci]
        centroid = vectors[rows].mean(axis=0)
        centre = rows[int(np.argmax(vectors[rows] @ centroid))]
        clusters.append({"id": ci, "size": len(g), "label": labels[ci], "center_id": notes[centre]["id"]})
    return {
        "built_at": now_iso(), "model": args.model,
        "nodes": [{
            "id": n["id"], "label": n["label"], "path": n["id"], "folder": n["folder"], "tags": n["tags"],
            "x": round(float(coords[i, 0]), 3), "y": round(float(coords[i, 1]), 3), "z": round(float(coords[i, 2]), 3),
            "cluster": int(assign[i]), "degree": degree.get(n["id"], 0), **n["extra"],
        } for i, n in enumerate(notes)],
        "clusters": clusters,
        "links": [{"source": a, "target": b} for a, b in sorted(seen)],
        "vectors": pack_vectors(vectors, args.vector_dims),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the 3D Semantic Graph's data from a folder of Markdown notes")
    ap.add_argument("notes", help="folder of Markdown notes")
    ap.add_argument("--out", default="semantic.json")
    ap.add_argument("--fields", default="", help="front matter fields to copy onto each node, comma separated (e.g. status,year)")
    ap.add_argument("--provider", choices=["ollama", "openai"], default="ollama")
    ap.add_argument("--ollama", default=os.environ.get("OLLAMA_URL", DEFAULT_OLLAMA_URL))
    ap.add_argument("--api-base", default=os.environ.get("EMBEDDINGS_API_BASE", ""), help="OpenAI-compatible base URL")
    ap.add_argument("--model", default=os.environ.get("EMBEDDINGS_MODEL", DEFAULT_MODEL))
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument("--vector-dims", type=int, default=DEFAULT_VECTOR_DIMS, help="dimensions kept for in-browser search")
    ap.add_argument("--cache", default="", help="file to keep embeddings in, so a rebuild only embeds changed notes")
    args = ap.parse_args()
    if args.provider == "openai" and not args.api_base:
        ap.error("--api-base is required with --provider openai")
    started = time.monotonic()
    try:
        data = build(args)
    except BuildError as exc:
        say(f"build failed: {exc}")
        return 2
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    say(f"{len(data['nodes'])} notes, {len(data['clusters'])} clusters, {len(data['links'])} links -> {args.out} "
        f"in {time.monotonic() - started:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
