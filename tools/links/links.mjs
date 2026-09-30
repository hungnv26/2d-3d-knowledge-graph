// Builds the Links graph from a folder of Markdown notes: every note is a node,
// every [[wikilink]] (or relative [text](note.md) link) that resolves to a note
// is an edge. Titles come from front matter `title:`, then the first `# heading`,
// then the file name; tags from front matter `tags:` and inline #tags.
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, posix, relative, sep } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', '.obsidian', '.trash'])

async function walk(dir, root, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) await walk(full, root, out)
    else if (e.name.toLowerCase().endsWith('.md')) out.push(relative(root, full).split(sep).join('/'))
  }
  return out
}

const frontMatter = (text) => text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''

export function parseTitle(text, fallback) {
  const fm = frontMatter(text)
  const t = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1]
  if (t) return t.trim()
  const h = text.replace(/^---[\s\S]*?\n---/, '').match(/^#\s+(.+)$/m)?.[1]
  return (h || fallback).trim()
}

export function parseTags(text) {
  const fm = frontMatter(text)
  const inline = fm.match(/^tags:\s*\[(.*?)\]/m)
  const listed = inline ? inline[1].split(',')
    : (fm.match(/^tags:\s*\r?\n((?:\s+-\s+.*\r?\n?)+)/m)?.[1] ?? '').split('\n').map((l) => l.replace(/^\s*-\s*/, ''))
  const tags = new Set(listed.map((t) => t.trim().replace(/^['"#]+|['"]+$/g, '')).filter(Boolean))
  // Inline #tags in the body, outside code.
  const body = text.replace(/^---[\s\S]*?\n---/, '').replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
  for (const m of body.matchAll(/(?:^|\s)#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu)) tags.add(m[1])
  return [...tags]
}

/** @param {string} root  @param {{ exclude?: (rel: string) => boolean }} [opts] */
export async function buildLinksGraph(root, opts = {}) {
  const files = (await walk(root, root)).filter((rel) => !opts.exclude?.(rel)).sort()
  const texts = new Map()
  for (const rel of files) texts.set(rel, await readFile(join(root, rel), 'utf8'))
  // A [[link]] may name a file ("fold-drive"), a path ("concepts/fold-drive") or a
  // title ("Fold Drive"); the file name wins, then the title, then its hyphenated form.
  const slugOf = (s) => s.toLowerCase().normalize('NFKD').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const byName = new Map()
  const byPath = new Map()
  const byTitle = new Map()
  for (const rel of files) {
    const name = basename(rel, '.md').toLowerCase()
    if (!byName.has(name)) byName.set(name, rel)
    if (!byName.has(slugOf(name))) byName.set(slugOf(name), rel)
    byPath.set(rel.slice(0, -3).toLowerCase(), rel)
    const title = parseTitle(texts.get(rel), '').toLowerCase()
    if (title && !byTitle.has(title)) byTitle.set(title, rel)
  }
  const resolveWiki = (target) => {
    const t = target.split('#')[0].trim().replace(/\.md$/i, '').toLowerCase()
    return byPath.get(t) || byName.get(posix.basename(t)) || byTitle.get(t) || byName.get(slugOf(posix.basename(t)))
  }
  const nodes = []
  const edges = []
  const degree = new Map()
  for (const rel of files) {
    const text = texts.get(rel)
    nodes.push({
      id: rel, title: parseTitle(text, basename(rel, '.md')),
      category: rel.includes('/') ? rel.split('/')[0] : 'root', linkCount: 0, path: rel, tags: parseTags(text),
    })
    const targets = []
    for (const m of text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g)) targets.push(resolveWiki(m[1]))
    for (const m of text.matchAll(/\]\(([^)\s]+\.md)(?:#[^)]*)?\)/gi)) {
      if (/^[a-z]+:/i.test(m[1])) continue
      const p = posix.normalize(posix.join(posix.dirname(rel), decodeURIComponent(m[1])))
      targets.push(byPath.get(p.slice(0, -3).toLowerCase()))
    }
    for (const to of targets) {
      if (!to || to === rel) continue
      edges.push({ from: rel, to })
      degree.set(rel, (degree.get(rel) || 0) + 1)
      degree.set(to, (degree.get(to) || 0) + 1)
    }
  }
  for (const n of nodes) n.linkCount = degree.get(n.id) || 0
  return { nodes, edges }
}
