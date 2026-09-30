// Ready-made hosts, so an app can hand the graphs its data without writing the
// request plumbing itself. createHost() answers the pages' requests from data,
// URLs or loaders; createStaticSemantic() serves a prebuilt semantic layout
// (tools/semantic writes one) with search and "closest notes" in the browser.
import type { GraphHost, OpenTarget, Platform } from './host'

// ------------------------------------------------------------ data shapes

/** A node of a link graph or a Graphify graph, as the Knowledge Graphs read it. */
export interface GraphNodeData {
  id: string
  title: string
  /** Top folder or any grouping; informational. */
  category?: string
  /** How many links touch it; the node limit keeps the most connected. */
  linkCount?: number
  /** Note path, for path: searches and colour groups. Defaults to the id. */
  path?: string
  tags?: string[]
  /** Graphify only: the note this node was extracted from. */
  note?: string | null
  community?: number | null
  communityName?: string
  /** Graphify only: document, concept, rationale or paper. */
  type?: string
  /** Anything else you keep on a node comes back in onOpen's `raw`. */
  [key: string]: unknown
}
export interface GraphEdgeData { from: string; to: string; relation?: string; inferred?: boolean }
export interface GraphData { nodes: GraphNodeData[]; edges: GraphEdgeData[] }

export interface SemanticNodeData {
  id: string
  label: string
  path?: string
  tags?: string[]
  x: number; y: number; z: number
  cluster: number
  degree: number
  /** Category fields (folder, status, year …), read through the page's categories. */
  [field: string]: unknown
}
export interface SemanticCluster { id: number; label: string; size: number; center_id: string }
export interface SemanticDataset {
  built_at?: string
  model?: string
  nodes: SemanticNodeData[]
  clusters: SemanticCluster[]
  links: { source: string; target: string }[]
  /** Unit vectors, one per node in node order, for search and closest notes. */
  vectors?: { dims: number; encoding: 'int8-base64'; data: string }
}
export interface SemanticHit { id: string; label: string; score: number }
export interface SemanticStatus {
  ready: boolean; building: boolean; build_line: string | null; build_failed: string | null
  stale?: boolean; built_at?: string; n_notes?: number; n_clusters?: number; n_links?: number
}

/** What the 3D Semantic Graph asks of its data. createStaticSemantic() is one; a server can be another. */
export interface SemanticProvider {
  status(): Promise<SemanticStatus>
  graph(scope?: string): Promise<SemanticDataset & { ready: boolean }>
  search?(query: string, limit: number, scope?: string): Promise<{ results: SemanticHit[]; error?: string }>
  neighbors?(id: string, limit: number): Promise<{ results: SemanticHit[] }>
  /** Start a rebuild of the layout; the page then polls status(). */
  build?(): Promise<{ started?: boolean; error?: string }>
}

// ------------------------------------------------------------------ host

type GraphInput = GraphData | string | (() => Promise<GraphData>)
export interface Storage { get(key: string): string | null; set(key: string, value: string): void }

export interface CreateHostOptions {
  /** Graph data by source id: the data itself, a URL to fetch, or a loader. */
  graphs?: Record<string, GraphInput>
  /** The 3D Semantic Graph's data. */
  semantic?: SemanticProvider
  /** A node was opened. `target.note` is the note to show; `target.quote` a passage to highlight. */
  onOpen?: (target: OpenTarget) => void
  /** Where settings are kept: the browser's localStorage (default), memory only, or your own. */
  storage?: 'local' | 'memory' | Storage
  /** Prefix for every settings key, so two apps on one origin keep separate settings. */
  storagePrefix?: string
  accent?: string
  /** Phone-width layout; defaults to a window narrower than 700 px. */
  compact?: boolean
  platform?: Platform
  debug?: boolean
  onNotify?: (type: string, payload?: Record<string, unknown>) => void
}

const memory = (): Storage => { const m = new Map<string, string>(); return { get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v) } } }
const local = (): Storage => ({
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
})

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function createHost(opts: CreateHostOptions = {}): GraphHost {
  const store = opts.storage === 'memory' ? memory() : opts.storage && typeof opts.storage === 'object' ? opts.storage : local()
  const prefix = opts.storagePrefix || ''
  const cache = new Map<string, Promise<GraphData>>()
  const loadGraph = (id: string): Promise<GraphData> => {
    if (!cache.has(id)) {
      const input = opts.graphs?.[id]
      const p = !input ? Promise.reject(new Error(`No graph for source "${id}"`))
        : typeof input === 'string' ? fetchJson<GraphData>(input)
          : typeof input === 'function' ? input()
            : Promise.resolve(input)
      // A failed load is tried again next time.
      cache.set(id, p.catch((err) => { cache.delete(id); throw err }))
    }
    return cache.get(id)!
  }
  const sem = () => {
    if (!opts.semantic) throw new Error('No semantic data: pass createHost({ semantic })')
    return opts.semantic
  }
  return {
    platform: opts.platform || 'web',
    compact: opts.compact ?? (typeof window !== 'undefined' && window.innerWidth < 700),
    accent: opts.accent,
    debug: opts.debug,
    async request<T>(type: string, p: Record<string, unknown> = {}): Promise<T> {
      const scope = typeof p.scope === 'string' ? p.scope : undefined
      switch (type) {
        case 'graph': return await loadGraph(String(p.source)) as T
        case 'semanticStatus': return await sem().status() as T
        case 'semanticGraph': return await sem().graph(scope) as T
        case 'semanticSearch': {
          const s = sem()
          if (!s.search) return { results: [], error: 'Search is not available for this graph.' } as T
          return await s.search(String(p.query || ''), Number(p.limit) || 12, scope) as T
        }
        case 'semanticNeighbors': {
          const s = sem()
          return (s.neighbors ? await s.neighbors(String(p.id), Number(p.limit) || 8) : { results: [] }) as T
        }
        case 'semanticBuild': {
          const s = sem()
          return (s.build ? await s.build() : { error: 'This graph cannot be rebuilt here.' }) as T
        }
        default: throw new Error(`Unknown request "${type}"`)
      }
    },
    open: (t) => opts.onOpen?.(t),
    loadSetting: (key) => store.get(prefix + key),
    saveSetting: (key, value) => store.set(prefix + key, JSON.stringify(value)),
    notify: opts.onNotify,
  }
}

// -------------------------------------------------------- static semantic

export interface StaticSemanticOptions {
  /** Which nodes each scope keeps, by scope id. A scope without a rule keeps everything. */
  scopes?: Record<string, (node: SemanticNodeData) => boolean>
  /**
   * Turns a query into a vector of the same model and size as the dataset's
   * vectors, for true search by meaning. Without it, search finds the notes
   * whose words match best and ranks everything by closeness to them.
   */
  embed?: (text: string) => Promise<number[]>
}

/** Serves a prebuilt semantic layout: from the object itself or from a URL. */
export function createStaticSemantic(source: SemanticDataset | string, opts: StaticSemanticOptions = {}): SemanticProvider {
  let loaded: Promise<SemanticDataset> | null = null
  let vecs: Int8Array | null = null
  let dims = 0
  const index = new Map<string, number>()
  const load = () => loaded ||= (typeof source === 'string' ? fetchJson<SemanticDataset>(source) : Promise.resolve(source)).then((d) => {
    d.nodes.forEach((n, i) => index.set(n.id, i))
    if (d.vectors?.encoding === 'int8-base64' && d.vectors.data) {
      const bin = atob(d.vectors.data)
      vecs = new Int8Array(bin.length)
      for (let i = 0; i < bin.length; i++) vecs[i] = (bin.charCodeAt(i) << 24) >> 24
      dims = d.vectors.dims
    }
    return d
  })
  const inScope = (d: SemanticDataset, scope?: string) => {
    const rule = scope ? opts.scopes?.[scope] : undefined
    return rule ? new Set(d.nodes.filter(rule).map((n) => n.id)) : null
  }
  const dot = (i: number, q: ArrayLike<number>) => {
    let s = 0
    const o = i * dims
    for (let k = 0; k < dims; k++) s += vecs![o + k] * q[k]
    return s
  }
  const norm = (v: ArrayLike<number>) => { let s = 0; for (let k = 0; k < v.length; k++) s += v[k] * v[k]; return Math.sqrt(s) || 1 }
  const rowNorms = new Map<number, number>()
  const rowNorm = (i: number) => {
    let n = rowNorms.get(i)
    if (n == null) { n = norm(vecs!.subarray(i * dims, (i + 1) * dims)); rowNorms.set(i, n) }
    return n
  }
  const rank = (d: SemanticDataset, q: ArrayLike<number>, limit: number, keep: Set<string> | null, skip?: string): SemanticHit[] => {
    const qn = norm(q)
    const scored: SemanticHit[] = []
    d.nodes.forEach((n, i) => {
      if (n.id === skip || (keep && !keep.has(n.id))) return
      scored.push({ id: n.id, label: n.label, score: dot(i, q) / (rowNorm(i) * qn) })
    })
    return scored.sort((a, b) => b.score - a.score).slice(0, limit)
  }
  return {
    async status() {
      const d = await load()
      return { ready: true, building: false, build_line: null, build_failed: null, built_at: d.built_at, n_notes: d.nodes.length, n_clusters: d.clusters.length, n_links: d.links.length }
    },
    async graph(scope) {
      const d = await load()
      const keep = inScope(d, scope)
      if (!keep) return { ...d, ready: true }
      const nodes = d.nodes.filter((n) => keep.has(n.id))
      const sizes = new Map<number, number>()
      for (const n of nodes) sizes.set(n.cluster, (sizes.get(n.cluster) || 0) + 1)
      return {
        ...d, ready: true, nodes,
        clusters: d.clusters.filter((c) => sizes.has(c.id)).map((c) => ({ ...c, size: sizes.get(c.id)! })),
        links: d.links.filter((l) => keep.has(l.source) && keep.has(l.target)),
      }
    },
    async search(query, limit, scope) {
      const d = await load()
      const keep = inScope(d, scope)
      if (!vecs) return { results: [], error: 'This dataset has no vectors to search.' }
      if (opts.embed) return { results: rank(d, await opts.embed(query), limit, keep) }
      // Without a model: the notes whose words match best seed the search, and
      // everything is ranked by closeness to them.
      const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2)
      // A word in the title counts three times as much as one in the tags or path.
      const scoreText = (n: SemanticNodeData) => {
        const title = n.label.toLowerCase()
        const rest = `${(n.tags || []).join(' ')} ${n.path || n.id}`.toLowerCase()
        return words.reduce((s, w) => s + (title.includes(w) ? 3 : 0) + (rest.includes(w) ? 1 : 0), 0)
      }
      const seeds = d.nodes.map((n, i) => ({ i, s: scoreText(n) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5)
      if (!seeds.length) return { results: [], error: 'No notes use those words.' }
      const q = new Float32Array(dims)
      for (const { i } of seeds) { const r = rowNorm(i); for (let k = 0; k < dims; k++) q[k] += vecs[i * dims + k] / r }
      return { results: rank(d, q, limit, keep) }
    },
    async neighbors(id, limit) {
      const d = await load()
      const i = index.get(id)
      if (i == null || !vecs) return { results: [] }
      return { results: rank(d, vecs.subarray(i * dims, (i + 1) * dims), limit, null, id) }
    },
  }
}
