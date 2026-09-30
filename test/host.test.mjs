import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

// host-helpers has no DOM or 3D imports, so it runs in Node as-is.
const bundled = await build({ entryPoints: [new URL('../src/host-helpers.ts', import.meta.url).pathname], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { createHost, createStaticSemantic } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))

const vec = (...xs) => Int8Array.from(xs)
const pack = (rows) => Buffer.from(Int8Array.from(rows.flatMap((r) => [...r])).buffer).toString('base64')
const dataset = {
  built_at: '2026-01-01T00:00:00Z',
  nodes: [
    { id: 'a.md', label: 'Fold drive', tags: ['tech'], x: 0, y: 0, z: 0, cluster: 0, degree: 1, folder: 'tech' },
    { id: 'b.md', label: 'Jump echo', tags: ['physics'], x: 1, y: 0, z: 0, cluster: 0, degree: 1, folder: 'tech' },
    { id: 'c.md', label: 'Choir moss', tags: ['biology'], x: 0, y: 1, z: 0, cluster: 1, degree: 0, folder: 'species' },
  ],
  clusters: [{ id: 0, label: 'tech', size: 2, center_id: 'a.md' }, { id: 1, label: 'life', size: 1, center_id: 'c.md' }],
  links: [{ source: 'a.md', target: 'b.md' }],
  vectors: { dims: 3, encoding: 'int8-base64', data: pack([vec(127, 0, 0), vec(100, 60, 0), vec(0, 0, 127)]) },
}

test('createHost answers graph requests from data, loaders and caches them', async () => {
  let calls = 0
  const host = createHost({ graphs: { a: { nodes: [], edges: [] }, b: async () => { calls++; return { nodes: [{ id: 'x', title: 'X' }], edges: [] } } }, storage: 'memory' })
  assert.deepEqual(await host.request('graph', { source: 'a' }), { nodes: [], edges: [] })
  await host.request('graph', { source: 'b' }); await host.request('graph', { source: 'b' })
  assert.equal(calls, 1)
  await assert.rejects(host.request('graph', { source: 'missing' }), /No graph for source/)
})

test('createHost keeps settings in the storage it is given, with a prefix', () => {
  const store = new Map()
  const host = createHost({ storage: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, v) }, storagePrefix: 'app.' })
  host.saveSetting('kg.2d', { v: 1 })
  assert.equal(store.get('app.kg.2d'), '{"v":1}')
  assert.equal(host.loadSetting('kg.2d'), '{"v":1}')
})

test('createHost passes opened nodes to onOpen', () => {
  let opened
  createHost({ onOpen: (t) => { opened = t }, storage: 'memory' }).open({ id: 'n', note: 'n.md', title: 'N', quote: 'q' })
  assert.equal(opened.note, 'n.md')
})

test('static semantic: status, scopes, closest notes and keyword-seeded search', async () => {
  const sem = createStaticSemantic(dataset, { scopes: { tech: (n) => n.folder === 'tech' } })
  const status = await sem.status()
  assert.equal(status.ready, true)
  assert.equal(status.n_notes, 3)
  const tech = await sem.graph('tech')
  assert.deepEqual(tech.nodes.map((n) => n.id), ['a.md', 'b.md'])
  assert.deepEqual(tech.clusters.map((c) => [c.id, c.size]), [[0, 2]])
  assert.equal((await sem.graph('all')).nodes.length, 3, 'a scope without a rule keeps everything')
  const near = await sem.neighbors('a.md', 2)
  assert.equal(near.results[0].id, 'b.md')
  assert.ok(near.results[0].score > near.results[1].score)
  const found = await sem.search('fold', 3)
  assert.equal(found.results[0].id, 'a.md')
  assert.equal(found.results.at(-1).id, 'c.md')
  assert.match((await sem.search('zzz', 3)).error, /No notes/)
  const scoped = await sem.search('fold', 3, 'tech')
  assert.ok(scoped.results.every((r) => r.id !== 'c.md'))
})

test('static semantic uses an embed function for true search by meaning', async () => {
  const sem = createStaticSemantic(dataset, { embed: async () => [0, 0, 1] })
  assert.equal((await sem.search('anything', 1)).results[0].id, 'c.md')
})
