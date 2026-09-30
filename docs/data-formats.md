# Data formats

JSON Schemas for all of these are in [`schemas/`](../schemas/).

## Links and Graphify graphs

The 2D and 3D Knowledge Graphs read the same shape for every source:

```json
{
  "nodes": [
    { "id": "worlds/keplers-lantern.md", "title": "Kepler's Lantern", "category": "worlds",
      "linkCount": 14, "path": "worlds/keplers-lantern.md", "tags": ["world", "navigation"] }
  ],
  "edges": [
    { "from": "worlds/keplers-lantern.md", "to": "crew/orrery.md" }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | Unique and stable. For notes, the path relative to the notes folder. |
| `title` | The label. |
| `path` | What `path:` queries and colour groups match. Defaults to `id`. |
| `tags` | For `tag:` queries, and tag nodes when "Tags" is on. Nested tags like `a/b/c` work. |
| `linkCount` | Used to keep the most connected nodes when the node limit is on. |
| `edges` | `from` and `to` are node ids. Direction is ignored, duplicates are merged, and edges to unknown ids are dropped. |

A **Graphify** source adds these fields:

| Field | Meaning |
|---|---|
| `note` | The note this node was extracted from, which a click opens. `null` means nothing to open. |
| `type` | `document` (the note itself), `concept`, `rationale` or `paper`. |
| `communityName` | The community Graphify put it in, used by Colour by → Community and `community:` queries. |
| edge `inferred` | `true` when Graphify reasoned the link rather than reading it; drawn with a warm tint. |
| edge `relation` | `references`, `cites`, `conceptually_related_to` …, kept for your own use. |

`kg-graphify` makes this from Graphify's `graphify-out/graph.json`:
- It resolves each node's `source_file` to a note, by exact path first and then by file name.
- It marks as inferred every link whose confidence is not `EXTRACTED`.
- Use `--strip-prefix wiki/` when Graphify ran one folder above your notes.

## Semantic layout

```json
{
  "built_at": "2026-09-30T15:05:00Z",
  "model": "bge-m3",
  "nodes": [
    { "id": "species/choir-moss.md", "label": "Choir Moss", "path": "species/choir-moss.md",
      "folder": "species", "tags": ["species", "xenobiology"],
      "x": 12.4, "y": -30.1, "z": 8.9, "cluster": 2, "degree": 7, "status": "succeeded", "year": 2189 }
  ],
  "clusters": [{ "id": 2, "label": "xenobiology · biome/ocean/reef", "size": 54, "center_id": "species/choir-moss.md" }],
  "links": [{ "source": "species/choir-moss.md", "target": "worlds/the-glass-tides-of-oru.md" }],
  "vectors": { "dims": 256, "encoding": "int8-base64", "data": "…" }
}
```

- `x`, `y` and `z` are positions, roughly −100 to 100. The graph never moves them; the Spread slider scales them.
- `cluster` indexes `clusters`, and cluster 0 is the largest.
- Any other field on a node, such as `status`, `year` or `owner`, can be a colour mode and a query field through `categories`.
- `vectors` is optional. It holds one unit vector per node in node order, reduced with PCA and stored as int8, for in-browser "closest in meaning" and search. Without it, search needs a server.

`tools/semantic/build.py` makes this from a folder of Markdown notes:
- **Embeddings:** Ollama by default (`bge-m3`), or any OpenAI-compatible endpoint with `--provider openai --api-base … --model …`, reading the key from `EMBEDDINGS_API_KEY`.
- **Layout:** UMAP to 3D, falling back to PCA below 6 notes.
- **Clusters:** seeded k-means, about √(n/2) clusters between 4 and 24, each named after its most distinctive tags.
- **Links:** the notes' own `[[links]]`, plus the closest neighbours of any note with no links.
- `--fields status,year` copies front matter fields onto the nodes.
- `--cache emb.json` re-embeds only the notes that changed.
