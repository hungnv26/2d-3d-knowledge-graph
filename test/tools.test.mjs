import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { buildLinksGraph, parseTags, parseTitle } from '../tools/links/links.mjs'
import { convertGraphify, convertGraphifyFile } from '../tools/graphify/graphify.mjs'

const fixtures = new URL('./fixtures/', import.meta.url).pathname

test('titles: front matter, then heading, then file name', () => {
  assert.equal(parseTitle('---\ntitle: "Quoted"\n---\n# Heading', 'file'), 'Quoted')
  assert.equal(parseTitle('# Heading here\ntext', 'file'), 'Heading here')
  assert.equal(parseTitle('just text', 'file'), 'file')
})

test('tags: inline list, YAML list and body tags, never from code', () => {
  assert.deepEqual(parseTags('---\ntags: [a, "#b"]\n---\nText #c/d here'), ['a', 'b', 'c/d'])
  assert.deepEqual(parseTags('---\ntags:\n  - x\n  - y\n---\n'), ['x', 'y'])
  assert.deepEqual(parseTags('```\n#nope\n```\n`#nope2` #yes'), ['yes'])
})

test('kg-links resolves wikilinks, aliases, headings-free names and relative links', async () => {
  const g = await buildLinksGraph(fixtures + 'notes')
  const ids = g.nodes.map((n) => n.id).sort()
  assert.deepEqual(ids, ['concepts/fold-drive.md', 'concepts/resonance.md', 'orphan.md', 'people/captain-ines.md'])
  const pairs = g.edges.map((e) => `${e.from} -> ${e.to}`).sort()
  assert.deepEqual(pairs, [
    'concepts/fold-drive.md -> concepts/resonance.md',
    'concepts/fold-drive.md -> people/captain-ines.md',
    'concepts/resonance.md -> concepts/fold-drive.md',
    'people/captain-ines.md -> concepts/fold-drive.md',
  ])
  const fold = g.nodes.find((n) => n.id === 'concepts/fold-drive.md')
  assert.equal(fold.title, 'Fold Drive')
  assert.equal(fold.category, 'concepts')
  assert.equal(fold.linkCount, 4)
  assert.deepEqual(fold.tags.sort(), ['hazard/radiation', 'physics', 'tech/propulsion'])
  assert.equal(g.nodes.find((n) => n.id === 'orphan.md').linkCount, 0)
})

test('kg-graphify resolves notes by path, prefix and file name, and marks inferred links', async () => {
  const g = await convertGraphifyFile(fixtures + 'graph.json', fixtures + 'notes', { stripPrefix: 'wiki/' })
  const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]))
  assert.equal(by.doc_fold.note, 'concepts/fold-drive.md')
  assert.equal(by.c_drift.note, 'concepts/resonance.md')
  assert.equal(by.c_lost.note, null, 'a node whose note is gone opens nothing')
  assert.equal(by.c_name.note, 'people/captain-ines.md', 'found by file name')
  assert.equal(by.doc_fold.type, 'document')
  assert.equal(by.c_drift.communityName, 'Propulsion')
  assert.deepEqual(g.edges.map((e) => !!e.inferred), [false, true, true])
  assert.equal(by.c_drift.linkCount, 2)
})

test('kg-graphify without a notes folder keeps Markdown source files as notes', () => {
  const g = convertGraphify({ nodes: [{ id: 'a', label: 'A', source_file: 'x/a.md' }, { id: 'b', label: 'B', source_file: 'code.py' }], links: [] })
  assert.equal(g.nodes[0].note, 'x/a.md')
  assert.equal(g.nodes[1].note, null)
})
