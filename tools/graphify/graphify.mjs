// Turns Graphify's output (graphify-out/graph.json, networkx node-link) into
// the Graphify graph the Knowledge Graphs draw. Each node points at the note it
// was extracted from (exact path first, then the file name; a node whose note
// is gone gets none rather than a guess), keeps its community and kind, and a
// link Graphify reasoned its way to (confidence other than EXTRACTED) is marked
// inferred. Graphify: https://github.com/Graphify-Labs/graphify (Apache-2.0).
import { readdir, readFile } from 'node:fs/promises'
import { basename, join, relative, sep } from 'node:path'

async function listNotes(dir, root, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'graphify-out') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) await listNotes(full, root, out)
    else if (e.name.toLowerCase().endsWith('.md')) out.push(relative(root, full).split(sep).join('/'))
  }
  return out
}

/**
 * @param {object} raw  graph.json contents
 * @param {string[]} [notes]  note paths relative to the notes folder, to resolve each node's note
 * @param {{ stripPrefix?: string }} [opts]  a prefix Graphify put on source_file (for example "wiki/")
 */
export function convertGraphify(raw, notes = [], opts = {}) {
  const have = new Set(notes)
  const byName = new Map()
  for (const n of notes) if (!byName.has(basename(n))) byName.set(basename(n), n)
  const strip = opts.stripPrefix ? new RegExp('^' + opts.stripPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : null
  const noteOf = (sourceFile) => {
    let p = String(sourceFile ?? '').replace(/^\.?\//, '')
    if (strip) p = p.replace(strip, '')
    if (!p || p.includes('..')) return null
    if (!notes.length) return p.toLowerCase().endsWith('.md') ? p : null
    if (have.has(p)) return p
    return byName.get(basename(p)) ?? null
  }
  const links = raw.links ?? raw.edges ?? []
  const degree = new Map()
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) || 0) + 1)
    degree.set(l.target, (degree.get(l.target) || 0) + 1)
  }
  const nodes = (raw.nodes ?? []).map((n) => {
    const note = noteOf(n.source_file)
    return {
      id: n.id,
      title: n.label ?? n.id,
      category: note && note.includes('/') ? note.split('/')[0] : 'root',
      linkCount: degree.get(n.id) || 0,
      note,
      path: note || '',
      community: typeof n.community === 'number' ? n.community : null,
      communityName: typeof n.community_name === 'string' ? n.community_name : '',
      type: typeof n.file_type === 'string' ? n.file_type : '',
    }
  })
  const edges = links.map((l) => ({
    from: l.source, to: l.target,
    ...(l.relation ? { relation: l.relation } : {}),
    ...(l.confidence && l.confidence !== 'EXTRACTED' ? { inferred: true } : {}),
  }))
  return { nodes, edges }
}

export async function convertGraphifyFile(graphJsonPath, notesRoot, opts = {}) {
  const raw = JSON.parse(await readFile(graphJsonPath, 'utf8'))
  const notes = notesRoot ? await listNotes(notesRoot, notesRoot) : []
  return convertGraphify(raw, notes, opts)
}
