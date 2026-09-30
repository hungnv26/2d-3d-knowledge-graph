import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { validate } from './validate.mjs'

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'))
const data = '../sample-data/meridian/'

for (const [file, schema] of [['links.json', 'links-graph'], ['graphify.json', 'links-graph'], ['semantic.json', 'semantic'], ['graphify-out/graph.json', 'graphify-output']]) {
  test(`${file} matches schemas/${schema}.schema.json`, async () => {
    const errors = validate(await read(`../schemas/${schema}.schema.json`), await read(data + file))
    assert.deepEqual(errors.slice(0, 5), [])
  })
}

test('the Meridian Archive shows every feature it is meant to', async () => {
  const links = await read(data + 'links.json')
  const graphify = await read(data + 'graphify.json')
  const semantic = await read(data + 'semantic.json')
  const nb = new Map()
  for (const e of links.edges) { (nb.get(e.from) || nb.set(e.from, new Set()).get(e.from)).add(e.to); (nb.get(e.to) || nb.set(e.to, new Set()).get(e.to)).add(e.from) }
  const leaves = [...nb.values()].filter((s) => s.size === 1).length
  const orphans = links.nodes.filter((n) => !nb.has(n.id)).length
  const hubs = [...nb.values()].filter((s) => s.size >= 40).length
  assert.ok(links.nodes.length >= 600, 'about 660 notes')
  assert.ok(leaves >= 80, 'single-link leaves for Hubs mode')
  assert.ok(orphans >= 20, 'orphans for the Orphans filter')
  assert.ok(hubs >= 15, 'topic maps as hubs')
  assert.ok(new Set(links.nodes.flatMap((n) => n.tags)).size >= 50, 'tags, some nested')
  assert.ok(links.nodes.some((n) => n.tags.some((t) => t.split('/').length >= 3)), 'nested tags')
  assert.ok(graphify.nodes.length > 2500, 'large enough for the node limit')
  assert.deepEqual([...new Set(graphify.nodes.map((n) => n.type))].sort(), ['concept', 'document', 'paper', 'rationale'])
  assert.ok(new Set(graphify.nodes.map((n) => n.communityName)).size >= 50, 'many communities')
  assert.ok(graphify.edges.filter((e) => e.inferred).length > 400, 'inferred links')
  assert.ok(graphify.nodes.every((n) => n.note), 'every Graphify node opens a note')
  assert.ok(semantic.clusters.length >= 10, 'clusters')
  assert.ok(semantic.nodes.some((n) => n.status) && semantic.nodes.some((n) => n.year), 'status and year to colour by')
  assert.equal(atob(semantic.vectors.data).length, semantic.nodes.length * semantic.vectors.dims, 'one vector per note')
})

test('every Graphify concept appears in the note it opens, so the passage can be highlighted', async () => {
  const graphify = await read(data + 'graphify.json')
  const misses = []
  for (const n of graphify.nodes.filter((x) => x.type === 'concept').slice(0, 400)) {
    const text = (await readFile(new URL(data + 'notes/' + n.note, import.meta.url), 'utf8')).toLowerCase()
    if (!text.includes(n.title.toLowerCase())) misses.push(n.title)
  }
  assert.deepEqual(misses.slice(0, 5), [])
})
