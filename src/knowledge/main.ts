// 2D Knowledge Graph: a live d3-force simulation on a canvas with an
// Obsidian-style Filters / Groups / Display / Forces panel. It draws one of the
// sources the host offers (typically the links between your notes and the
// Graphify graph), switched at the top left; every source uses the same engine,
// look and settings panel. Framework-free and mounted into an element.
import { forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { escapeHtml, icons, injectStyle, type GraphHost, type GraphPage, type GraphSource, type Group } from '../host'
// @ts-expect-error bundled as text by esbuild
import css from './knowledge.css'

type Section = 'filters' | 'groups' | 'display' | 'forces' | 'legend'
/** What a node's base colour means. Groups from the panel always win over it. */
type ColorMode = 'community' | 'kind' | 'groups'
interface Settings {
  colorBy: ColorMode
  v: number; search: string; tags: boolean; orphans: boolean; groups: Group[]
  /** Draw only the N most connected nodes; 0 draws everything. */
  limit: number
  display: { nodeSize: number; linkThickness: number; textFade: number; motion: boolean; hubs: boolean }
  forces: { center: number; repel: number; link: number; linkDistance: number }
  /** The force animation: whether it runs when the graph opens, and its
   * speed (1× goes there and back once every ANIM_CYCLE_S). */
  animate: { speed: number; playing: boolean }
  open: Record<Section, boolean>
}
interface RawNode {
  id: string; title: string; category: string; linkCount: number; path?: string; tags?: string[]; x?: number; y?: number
  // Graphify only: the note the node was extracted from, its community and kind.
  note?: string | null; community?: number | null; communityName?: string; type?: string
}
export interface KnowledgeOptions {
  /** The graphs this page can draw; the first is the default. */
  sources: GraphSource[]
  /** Where the page remembers which source it showed last. */
  sourceKey: string
  /** Open on this source instead of the remembered one. */
  initialSource?: string
  /** The initial source's graph, when the host already has it. */
  initialData?: unknown
}
interface RawGraph { nodes: RawNode[]; edges: { from: string; to: string; relation?: string; inferred?: boolean }[] }
interface GNode extends SimulationNodeDatum {
  id: string; label: string; kind: 'note' | 'tag'; path: string; tags: string[]
  /** The note a click opens: a note path, or null when there is none. */
  note: string | null
  community: string; type: string
  labelLower: string; pathLower: string; tagsLower: string[]; communityLower: string
  deg: number; r: number; color: string; nb: Set<GNode>
  /** Outside the legend's focus: drawn faint. */
  dim: boolean
  /** A hub: several nodes hang off it and nothing else. */
  hub: boolean
  /** How many single-link nodes hang off this hub. */
  leaves: number
  /** For a single-link node: the hub it hangs off, if any. */
  leafOf: GNode | null
  /** The node as the host delivered it; handed back when it is opened. */
  raw?: RawNode
}
interface GLink extends SimulationLinkDatum<GNode> { w: number; inferred: boolean; spoke: boolean }
interface Term { field: 'any' | 'path' | 'file' | 'tag' | 'community' | 'type'; value: string; neg: boolean }

export function mountKnowledge(root: HTMLElement, host: GraphHost, opts: KnowledgeOptions): GraphPage {
const compact = host.compact
let destroyed = false
// Each source keeps its own settings under its own key, and the page
// remembers which one it showed last.
const SOURCES = opts.sources
const SOURCE_KEY = opts.sourceKey
const sourceById = (id: unknown) => SOURCES.find((x) => x.id === id)
const savedSource = (): GraphSource | undefined => {
  try { return sourceById(JSON.parse(host.loadSetting(SOURCE_KEY) || '""')) } catch { return undefined }
}
let SRC: GraphSource = sourceById(opts.initialSource) || savedSource() || SOURCES[0]
let GRAPHIFY = false
let NOUN = ''
let SETTINGS_KEY = ''
let SETTINGS_VERSION = 1
const useSource = (src: GraphSource) => {
  SRC = src
  GRAPHIFY = !!src.graphify
  NOUN = src.noun || (GRAPHIFY ? 'nodes' : 'notes')
  SETTINGS_KEY = src.settingsKey
  SETTINGS_VERSION = src.settingsVersion || 1
}
useSource(SRC)
const LIMIT_OPTIONS = [400, 800, 1500, 3000]
const MIN_SCREEN_R = 2.4         // px: zoomed-out notes stay visible
const GRAB_PX = 7                // px: how far from a note's edge a press still grabs it
const TOUCH_GRAB_PX = 14         // fingers are less precise than a pointer
const WARMUP_TICKS = 150         // ticks run before the first paint, at a fast cooling rate
const WARMUP_DECAY = 0.02        // d3's own cooling rate: converges in a few hundred ticks
const WARMUP_FRICTION = 0.4      // notes travel freely while the layout forms
const CALM_FRICTION = 0.6        // and glide once it is shown
const COOL_DECAY = 0.006         // afterwards: slow, gentle settling
const BIG_GRAPH = 1200           // above this the warm-up yields to the page between chunks
const DRAG_ALPHA = 0.04          // simulation heat while dragging: neighbours follow, the rest stays calm
const NEIGHBOUR_LABELS_MAX = 30  // hovering a bigger hub labels only the hub
// Hubs mode: a hub is a node that several single-link nodes hang off. In the
// Graphify graph that is a note with the ideas extracted from it. Its spokes
// take its colour and pull the leaves in tight, so each flower reads as one.
const HUB_MIN_LEAVES = 3         // fewer than this and a node is just a node
const SPOKE_DISTANCE = 0.45      // spokes are this fraction of the link distance
const SPOKE_STRENGTH = 1.6       // and hold on harder, so leaves stay with their hub
const HUB_RING = 'rgba(255,255,255,0.75)'
// Force animation: the centre force runs up from 40% to the maximum while the
// repel force runs down from 100% to 20%, then both run back, on a smooth
// there-and-back wave. Transport controls match the 3D graph's orbit.
const ANIM_CENTER: [number, number] = [0.4, 1]   // slider range 0 to 1
const ANIM_REPEL: [number, number] = [20, 4]     // slider range 0 to 20
const ANIM_CYCLE_S = 30                          // 1×: there and back once every 30 seconds
const ANIM_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
const ANIM_BLEND_MS = 2500                       // glides in from, and back to, the user's own values
const ANIM_HEAT = 0.05                           // simulation heat while animating, so the layout follows
const ANIM_HEAT_BIG = 0.02                       // a graph of thousands moves more for the same heat
// Both graphs share Obsidian's bright look on the same dark canvas: a muted
// theme was tried for Graphify and made the graph hard to see. Graphify uses
// the same folder colours, swapped around, so the two graphs can be told apart.
const ACCENT = '#8b7cf6'   // highlighted links, like Obsidian's accent
const BRIGHT = ['#e05252', '#e0b152', '#52e052', '#52e0b1', '#52b1e0', '#5a5ae2', '#b152e0', '#e052b1', '#f28c3a', '#a8e04a', '#4fb3e8', '#e84fb0', '#ffe066', '#6f8bff']
const BRIGHT_BASE = '#4a4a4a'    // what the smaller communities are blended toward
const KIND_COLOR: Record<string, string> = { document: '#e6e6e6', concept: '#52e052', rationale: '#e0b152', paper: '#b152e0' }
const KIND_LABEL: Record<string, string> = { document: 'Notes', concept: 'Concepts', rationale: 'Rationales', paper: 'Papers and studies' }
const KIND_HINT: Record<string, string> = {
  document: 'the note itself', concept: 'an idea, person or term in a note', rationale: 'a reason a note gives', paper: 'a study a note cites',
}
const LEGEND_ROWS = 12
const NEW_GROUP_COLORS = ['#e05252', '#e0b152', '#b1e052', '#52e052', '#52e0b1', '#52b1e0', '#5a5ae2', '#b152e0', '#e052b1', '#f28c3a']
// `inferred` tints the links Graphify reasoned its way to; the link graph has none.
const THEME = { node: '#9a9a9a', tag: '#7fffd4', link: 'rgba(255,255,255,0.13)', inferred: 'rgba(255,214,120,0.45)', text: '#e6e6e6', textDim: 'rgba(230,230,230,0.35)', ring: '#ffffff' }

// The source's colour groups; the first matching group wins.
// A phone opens a large graph on its most connected nodes, and says so.
const defaults = (): Settings => ({
  v: SETTINGS_VERSION, search: '', tags: false, orphans: true, limit: GRAPHIFY && compact ? 800 : 0,
  // Both graphs colour by folder. Graphify can also colour by community or kind.
  colorBy: 'groups',
  groups: SRC.groups.map((g) => ({ ...g })),
  display: { nodeSize: 1, linkThickness: 1, textFade: 0, motion: true, hubs: GRAPHIFY },
  forces: { center: 0.5, repel: 10, link: 1, linkDistance: 250 },
  // The animation runs when the graph opens, until the user pauses or stops it.
  animate: { speed: 1, playing: true },
  open: { filters: true, groups: !compact, display: false, forces: false, legend: false },
})
const loadSettings = (): Settings => {
  const d = defaults()
  try {
    const raw = host.loadSetting(SETTINGS_KEY)
    if (!raw) return d
    const s = JSON.parse(raw)
    if ((s.v || 0) < SETTINGS_VERSION) { s.groups = d.groups; s.colorBy = d.colorBy }
    return {
      ...d, ...s, v: SETTINGS_VERSION, search: typeof s.search === 'string' ? s.search : '',
      colorBy: !GRAPHIFY ? 'groups' : ['community', 'kind', 'groups'].includes(s.colorBy) ? s.colorBy : d.colorBy,
      limit: typeof s.limit === 'number' && s.limit >= 0 ? s.limit : d.limit,
      display: { ...d.display, ...(s.display || {}) },
      forces: { ...d.forces, ...(s.forces || {}) },
      animate: {
        speed: ANIM_SPEEDS.includes(s.animate?.speed) ? s.animate.speed : d.animate.speed,
        playing: typeof s.animate?.playing === 'boolean' ? s.animate.playing : d.animate.playing,
      },
      open: { ...d.open, ...(s.open || {}) },
      groups: Array.isArray(s.groups)
        ? s.groups.filter((g: any) => g && typeof g.query === 'string' && typeof g.color === 'string')
        : d.groups,
    }
  } catch { return d }
}
const S: Settings = loadSettings()

type AnimState = 'stopped' | 'playing' | 'paused' | 'returning'
type ForcePair = { center: number; repel: number }
const anim = {
  state: 'stopped' as AnimState,
  phase: 0,                       // 0 → 1 around one there-and-back cycle
  blend: 0,                       // 0 → 1 while gliding in or back out
  base: null as ForcePair | null, // the user's own values, restored by Stop
  from: null as ForcePair | null, // where the current glide started
}
// While the animation runs, the saved settings keep the user's own forces.
const persist = () => host.saveSetting(SETTINGS_KEY, anim.base ? { ...S, forces: { ...S.forces, ...anim.base } } : S)

// ------------------------------------------------------------ query language
// Obsidian-style: terms are ANDed; path:, file:, tag: fields; -term negates;
// "quoted phrases" keep spaces. A bare term matches label, path or tags.
const parseQuery = (q: string): Term[] => {
  const terms: Term[] = []
  const re = /(-)?(?:(path|file|tag|community|type):)?(?:"([^"]*)"|(\S+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(q))) {
    const value = (m[3] ?? m[4] ?? '').toLowerCase()
    if (!value) continue
    terms.push({ neg: !!m[1], field: (m[2] as Term['field']) || 'any', value })
  }
  return terms
}
const tagHit = (n: GNode, v: string) => n.kind === 'tag'
  ? n.labelLower.slice(1) === v || n.labelLower.slice(1).startsWith(v + '/')
  : n.tagsLower.some((x) => x === v || x.startsWith(v + '/'))
const matchTerm = (n: GNode, term: Term) => {
  const v = term.value.replace(/^#/, '')
  let hit: boolean
  switch (term.field) {
    case 'path': hit = n.pathLower.includes(term.value); break
    case 'file': hit = n.labelLower.includes(term.value); break
    case 'tag': hit = tagHit(n, v); break
    case 'community': hit = n.communityLower.includes(term.value); break
    case 'type': hit = n.type === term.value; break
    default: hit = n.labelLower.includes(term.value) || n.pathLower.includes(term.value) || n.tagsLower.some((x) => x.includes(v))
      || n.communityLower.includes(term.value)
  }
  return term.neg ? !hit : hit
}
const matchesAll = (n: GNode, terms: Term[]) => terms.every((term) => matchTerm(n, term))

// ------------------------------------------------------------------- DOM
injectStyle('graph-knowledge-css', css)
const app = root
app.innerHTML = `
<div class="og">
  <canvas class="og__canvas"></canvas>
  <div class="og__msg">Loading the graph…</div>
  <div class="og__hud"></div>
  <div class="og__zoom">
    <button type="button" data-act="zin" title="Zoom in">${icons.plus}</button>
    <button type="button" data-act="zout" title="Zoom out">${icons.minus}</button>
    <button type="button" data-act="fit" title="Fit to view">${icons.fit}</button>
  </div>
  <button type="button" class="og__gear" title="Graph settings">${icons.gear}</button>
  <aside class="og__panel"></aside>
  <div class="og__card" hidden>
    <span class="og__card-dot"></span>
    <div class="og__card-t"><div class="og__card-title"></div><div class="og__card-sub"></div></div>
    <button type="button" class="og__card-open">Open note</button>
  </div>
</div>`
const $ = <T extends HTMLElement>(sel: string, root: ParentNode = app) => root.querySelector(sel) as T
const canvas = $<HTMLCanvasElement>('.og__canvas')
const msgEl = $('.og__msg')
const hudEl = $('.og__hud')
const gearEl = $<HTMLButtonElement>('.og__gear')
const panelEl = $('.og__panel')
const cardEl = $('.og__card')

let panelOpen = !compact
const showPanel = (open: boolean) => {
  panelOpen = open
  panelEl.style.display = open ? '' : 'none'
  gearEl.style.display = open ? 'none' : ''
}

// ------------------------------------------------------------- graph state
let data: RawGraph | null = null
let nodes: GNode[] = []
let links: GLink[] = []
let sim: Simulation<GNode, GLink> | null = null
const posCache = new Map<string, { x: number; y: number }>()
let k = 1, tx = 0, ty = 0          // view transform (screen = world * k + t)
let W = 0, H = 0, dpr = 1
let hover: GNode | null = null
let selected: GNode | null = null  // touch selection, shown in the card
let dragNode: GNode | null = null
let panning = false
let moved = false
let lastX = 0, lastY = 0, downX = 0, downY = 0
let lastMove: { x: number; y: number } | null = null
let dirty = true
let frameNo = 0
let lastFrame = 0
let appear = 0                      // 0 → 1 fade-in after (re)building the graph
let hoverAnim = 0                   // 0 → 1 eased highlight
let fadeHover: GNode | null = null  // note whose highlight is fading out
let zoomTarget: { k: number; tx: number; ty: number } | null = null
let shownCount = 0

// Communities ranked by size over the whole graph, so a colour means the same
// community whatever is filtered. The largest get a colour of their own; the
// rest share the palette, blended toward the canvas so they sit back.
let communityRank = new Map<string, number>()
let communitySize = new Map<string, number>()
let kindSize = new Map<string, number>()
let focus: string | null = null   // a community name or a kind, from the legend
const mix = (hex: string, toward: string, amount: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = p(hex), b = p(toward)
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('')
}
const communityColor = (name: string) => {
  const rank = communityRank.get(name)
  if (rank == null) return THEME.node
  const hue = BRIGHT[rank % BRIGHT.length]
  return rank < BRIGHT.length ? hue : mix(hue, BRIGHT_BASE, 0.35)
}
const baseColor = (n: GNode) => {
  if (n.kind === 'tag') return THEME.tag
  if (S.colorBy === 'community') return communityColor(n.community)
  if (S.colorBy === 'kind') return KIND_COLOR[n.type] || THEME.node
  return THEME.node
}
// In Community or Kind mode the plain folder groups step aside, or they would
// paint over the very colours that mode is showing. Groups the user wrote
// themselves (anything that is not a bare folder query) still win.
const isFolderGroup = (q: string) => /^path:wiki\/[\w-]+$/.test(q.trim())
const colorOf = (n: GNode, groups: { terms: Term[]; color: string; folder: boolean }[]) => {
  for (const g of groups) {
    if (!g.terms.length || (g.folder && S.colorBy !== 'groups')) continue
    if (matchesAll(n, g.terms)) return g.color
  }
  return baseColor(n)
}
const inFocus = (n: GNode) => focus === null || (S.colorBy === 'kind' ? n.type === focus : n.community === focus)
const indexMeaning = () => {
  communitySize = new Map(); kindSize = new Map()
  for (const n of data?.nodes || []) {
    if (n.communityName) communitySize.set(n.communityName, (communitySize.get(n.communityName) || 0) + 1)
    const t = (n.type || '').toLowerCase()
    if (t) kindSize.set(t, (kindSize.get(t) || 0) + 1)
  }
  communityRank = new Map([...communitySize.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name], i) => [name, i]))
}
const hubsOn = () => S.display.hubs
const radiusOf = (n: GNode) => {
  let r = n.kind === 'tag' ? 2.4 : Math.min(2.2 + Math.log2(1 + n.deg) * 0.7, 8.5)
  if (hubsOn()) {
    if (n.hub) r = Math.max(r, Math.min(4.6 + Math.log2(1 + n.leaves) * 1.1, 11))
    else if (n.leafOf) r *= 0.85
  }
  return r * S.display.nodeSize
}
const resize_nodes = () => { for (const n of nodes) n.r = radiusOf(n) }

const recolor = () => {
  const groups = S.groups.map((g) => ({ terms: parseQuery(g.query), color: g.color, folder: isFolderGroup(g.query) }))
  for (const n of nodes) { n.color = colorOf(n, groups); n.dim = !inFocus(n) }
  if (selected) $<HTMLElement>('.og__card-dot', cardEl).style.background = selected.color
  dirty = true
}

const updateHud = () => {
  if (!data) { hudEl.textContent = ''; return }
  const total = data.nodes.length
  hudEl.textContent = shownCount === total
    ? `${total.toLocaleString()} ${NOUN} · ${links.length.toLocaleString()} links`
    : `${shownCount.toLocaleString()} of ${total.toLocaleString()} ${NOUN} · ${links.length.toLocaleString()} links`
  if (anim.state === 'playing') hudEl.textContent += ' · animating forces'
  else if (anim.state === 'paused') hudEl.textContent += ' · animation paused'
}

// Build the displayed node/link set from the data and the filters, keeping
// each note's position between rebuilds so toggles do not scramble the layout.
const rebuild = () => {
  for (const n of nodes) if (n.x != null && n.y != null) posCache.set(n.id, { x: n.x, y: n.y })
  if (!data) { nodes = []; links = []; shownCount = 0; sim?.nodes([]); dirty = true; updateHud(); return }
  const byId = new Map<string, GNode>()
  const mk = (id: string, label: string, kind: GNode['kind'], path: string, tags: string[], raw?: RawNode): GNode => {
    const p = posCache.get(id) || (raw && raw.x != null && raw.y != null ? { x: raw.x, y: raw.y } : undefined)
    const community = raw?.communityName || ''
    return {
      id, label, kind, path, tags,
      // A wikilink node IS a note; a Graphify node points at the note it came from.
      note: kind === 'tag' ? null : GRAPHIFY ? raw?.note ?? null : id,
      community, type: (raw?.type || '').toLowerCase(),
      labelLower: label.toLowerCase(), pathLower: path.toLowerCase(), tagsLower: tags.map((x) => x.toLowerCase()), communityLower: community.toLowerCase(),
      deg: 0, r: 0, color: '', nb: new Set(), dim: false, hub: false, leaves: 0, leafOf: null, raw, x: p?.x, y: p?.y,
    }
  }
  // Optional cap: the most connected nodes carry the structure of a large graph.
  let source = data.nodes
  if (S.limit > 0 && source.length > S.limit) {
    source = [...source].sort((a, b) => (b.linkCount || 0) - (a.linkCount || 0)).slice(0, S.limit)
  }
  for (const n of source) byId.set(n.id, mk(n.id, n.title || n.id, 'note', n.path ?? (GRAPHIFY ? '' : n.id), n.tags || [], n))
  // The server sends every [[link]] occurrence; the graph wants each pair once.
  const pairs: [GNode, GNode, boolean][] = []
  const seen = new Set<string>()
  for (const e of data.edges) {
    const a = byId.get(e.from), b = byId.get(e.to)
    if (!a || !b || a === b) continue
    const key = a.id < b.id ? a.id + '\n' + b.id : b.id + '\n' + a.id
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push([a, b, e.inferred === true])
  }
  if (S.tags) {
    for (const n of source) {
      for (const tag of n.tags || []) {
        const id = 'tag:' + tag.toLowerCase()
        let tn = byId.get(id)
        if (!tn) { tn = mk(id, '#' + tag, 'tag', '', []); byId.set(id, tn) }
        pairs.push([byId.get(n.id)!, tn, false])
      }
    }
  }
  const terms = parseQuery(S.search)
  let keep = new Set<GNode>()
  for (const n of byId.values()) if (!terms.length || matchesAll(n, terms)) keep.add(n)
  const kept = pairs.filter(([a, b]) => keep.has(a) && keep.has(b))
  for (const [a, b] of kept) { a.deg++; b.deg++; a.nb.add(b); b.nb.add(a) }
  if (!S.orphans) keep = new Set([...keep].filter((n) => n.deg > 0))
  nodes = [...keep]
  // Hubs and their leaves. In Graphify only a note node can be a hub; in the
  // link graph any note with enough single-link neighbours is one.
  for (const n of nodes) { n.leaves = 0; n.hub = false; n.leafOf = null }
  for (const n of nodes) {
    if (n.deg !== 1 || n.kind === 'tag') continue
    const other = n.nb.values().next().value as GNode
    if (!GRAPHIFY || other.type === 'document') { n.leafOf = other; other.leaves++ }
  }
  for (const n of nodes) {
    n.hub = n.leaves >= HUB_MIN_LEAVES
    if (!n.hub) for (const m of n.nb) if (m.leafOf === n) m.leafOf = null
  }
  links = kept.map(([a, b, inferred]) => ({
    source: a, target: b, inferred, w: 1 / Math.max(1, Math.min(a.deg, b.deg)),
    spoke: a.leafOf === b || b.leafOf === a,
  }))
  resize_nodes()
  if (selected && !keep.has(selected)) select(null)
  if (hover && !keep.has(hover)) hover = null
  recolor()
  shownCount = nodes.filter((n) => n.kind !== 'tag').length
  if (sim) {
    sim.nodes(nodes)
    ;(sim.force('link') as any).links(links)
    applyForces()
    sim.alpha(Math.max(sim.alpha(), 0.2))
  }
  appear = 0
  dirty = true
  updateHud()
}

// Obsidian's sliders mapped onto d3-force. Link distance and repel are scaled
// to the canvas units used here (node radii of 2 to 9 world units).
const applyForces = () => {
  if (!sim) return
  const f = S.forces
  const hubs = hubsOn()
  ;(sim.force('link') as any)
    .distance((l: GLink) => f.linkDistance * 0.32 * (hubs && l.spoke ? SPOKE_DISTANCE : 1))
    .strength((l: GLink) => Math.min(1, l.w * f.link * (hubs && l.spoke ? SPOKE_STRENGTH : 1)))
  ;(sim.force('charge') as any).strength(-f.repel * 22)
  ;(sim.force('x') as any).strength(f.center * 0.12)
  ;(sim.force('y') as any).strength(f.center * 0.12)
  // The same heat moves a dense graph of thousands much more, so it gets less.
  const big = nodes.length > 2000
  sim.alphaTarget(animating() ? (big ? ANIM_HEAT_BIG : ANIM_HEAT) : S.display.motion ? (big ? 0.0012 : 0.004) : 0)
}

// ------------------------------------------------------- force animation
const animating = () => anim.state === 'playing' || anim.state === 'returning'
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Where the wave is: 0 at 40% centre / 100% repel, 1 at 100% centre / 20% repel. */
const waveAt = (phase: number) => (1 - Math.cos(2 * Math.PI * phase)) / 2
const waveForces = (phase: number): ForcePair => {
  const p = waveAt(phase)
  return { center: lerp(ANIM_CENTER[0], ANIM_CENTER[1], p), repel: lerp(ANIM_REPEL[0], ANIM_REPEL[1], p) }
}
// Only the two animated forces change, so a frame costs one pass over the nodes.
const applyAnimatedForces = () => {
  if (!sim) return
  ;(sim.force('charge') as any).strength(-S.forces.repel * 22)
  ;(sim.force('x') as any).strength(S.forces.center * 0.12)
  ;(sim.force('y') as any).strength(S.forces.center * 0.12)
  syncForceSliders()
}
const syncForceSliders = () => {
  for (const key of ['center', 'repel'] as const) {
    const input = panelEl.querySelector<HTMLInputElement>(`[data-range="forces.${key}"]`)
    if (input && Number(input.value) !== S.forces[key]) input.value = String(S.forces[key])
  }
}
const stepAnim = (dt: number) => {
  if (anim.state === 'playing') {
    anim.phase = (anim.phase + (dt * S.animate.speed) / (ANIM_CYCLE_S * 1000)) % 1
    anim.blend = Math.min(1, anim.blend + dt / ANIM_BLEND_MS)
    const w = waveForces(anim.phase), e = smooth(anim.blend), from = anim.from || w
    S.forces.center = lerp(from.center, w.center, e)
    S.forces.repel = lerp(from.repel, w.repel, e)
    applyAnimatedForces()
  } else if (anim.state === 'returning' && anim.base && anim.from) {
    anim.blend = Math.min(1, anim.blend + dt / ANIM_BLEND_MS)
    const e = smooth(anim.blend)
    S.forces.center = lerp(anim.from.center, anim.base.center, e)
    S.forces.repel = lerp(anim.from.repel, anim.base.repel, e)
    applyAnimatedForces()
    if (anim.blend >= 1) endAnim()
  }
}
const setAnimState = (state: AnimState) => {
  anim.state = state
  S.animate.playing = state === 'playing'
  applyForces()
  if (sim && animating() && sim.alpha() < 0.02) sim.alpha(0.02)
  renderTransport()
  updateHud()
  persist()
}
const playAnim = () => {
  if (anim.state === 'playing') return
  if (anim.state === 'stopped' || anim.state === 'returning') {
    const own = anim.base || { center: S.forces.center, repel: S.forces.repel }
    // Join the wave on its rising side at the user's own centre force, and
    // glide the repel force over to it, so nothing jumps.
    const p = Math.max(0, Math.min(1, (S.forces.center - ANIM_CENTER[0]) / (ANIM_CENTER[1] - ANIM_CENTER[0])))
    anim.base = own
    anim.phase = Math.acos(1 - 2 * p) / (2 * Math.PI)
    anim.from = { center: S.forces.center, repel: S.forces.repel }
    anim.blend = 0
  }
  setAnimState('playing')
}
const pauseAnim = () => { if (anim.state === 'playing') setAnimState('paused') }
/** Stop glides back to the forces the user had before pressing Play. */
const stopAnim = () => {
  if (anim.state === 'stopped' || anim.state === 'returning') return
  anim.from = { center: S.forces.center, repel: S.forces.repel }
  anim.blend = 0
  setAnimState('returning')
}
const endAnim = () => {
  if (anim.base) { S.forces.center = anim.base.center; S.forces.repel = anim.base.repel }
  anim.base = null; anim.from = null; anim.blend = 0
  applyAnimatedForces()
  setAnimState('stopped')
}
/** A hand on the centre or repel slider takes over: the animation lets go where it is. */
const abandonAnim = () => {
  if (anim.state === 'stopped') return
  anim.base = null; anim.from = null
  setAnimState('stopped')
}
const changeAnimSpeed = (dir: 1 | -1) => {
  const i = ANIM_SPEEDS.indexOf(S.animate.speed)
  S.animate.speed = ANIM_SPEEDS[Math.max(0, Math.min(ANIM_SPEEDS.length - 1, (i < 0 ? 2 : i) + dir))]
  renderTransport()
  persist()
}
const secondsPerCycle = () => Math.round((ANIM_CYCLE_S / S.animate.speed) * 10) / 10
const renderTransport = () => {
  const el = panelEl.querySelector<HTMLElement>('[data-transport]')
  if (!el) return
  const playing = anim.state === 'playing'
  const speed = S.animate.speed
  el.innerHTML = `
    <button type="button" class="og__tbtn${playing ? ' is-active' : ''}" data-anim="${playing ? 'pause' : 'play'}" title="${playing ? 'Pause' : 'Play'}">${playing ? icons.pause : icons.play}</button>
    <button type="button" class="og__tbtn" data-anim="stop" title="Stop and return to your own forces"${anim.state === 'stopped' || anim.state === 'returning' ? ' disabled' : ''}>${icons.stop}</button>
    <button type="button" class="og__tbtn" data-anim="slower" title="Slower"${speed <= ANIM_SPEEDS[0] ? ' disabled' : ''}>${icons.minus}</button>
    <span class="og__speed" title="There and back once every ${secondsPerCycle()} seconds">${speed}×</span>
    <button type="button" class="og__tbtn" data-anim="faster" title="Faster"${speed >= ANIM_SPEEDS[ANIM_SPEEDS.length - 1] ? ' disabled' : ''}>${icons.plus}</button>`
}

// Settle the layout before it is shown, so notes are not racing away from the
// pointer when the graph appears. A large graph does this in chunks and says so.
let settling = false
const settle = async () => {
  if (!sim || !nodes.length) return
  settling = true
  sim.alphaDecay(WARMUP_DECAY).velocityDecay(WARMUP_FRICTION).alpha(1)
  const total = nodes.length > BIG_GRAPH ? 300 : WARMUP_TICKS + 100
  if (nodes.length <= BIG_GRAPH) {
    for (let i = 0; i < total; i++) sim.tick()
  } else {
    msgEl.style.display = ''
    msgEl.textContent = `Laying out ${nodes.length.toLocaleString()} ${NOUN}…`
    const started = performance.now()
    let done = 0
    while (sim && done < total && performance.now() - started < 9000) {
      const chunk = performance.now()
      while (done < total && performance.now() - chunk < 40) { sim.tick(); done++ }
      await new Promise((r) => setTimeout(r, 0))
    }
    msgEl.style.display = 'none'
  }
  if (sim) {
    // Arrive at rest: whatever speed the warm-up left behind is dropped.
    for (const n of nodes) { n.vx = 0; n.vy = 0 }
    sim.alphaDecay(COOL_DECAY).velocityDecay(CALM_FRICTION).alpha(0.01)
    applyForces()
  }
  settling = false
  appear = 0
  dirty = true
}
const setupSim = () => {
  sim = forceSimulation<GNode, GLink>([])
    .stop()
    .alphaDecay(COOL_DECAY)
    .velocityDecay(CALM_FRICTION)
    .alphaMin(0.001)
    .force('link', forceLink<GNode, GLink>([]).id((d) => d.id))
    .force('charge', forceManyBody<GNode>().theta(0.9).distanceMax(900))
    .force('x', forceX<GNode>(0))
    .force('y', forceY<GNode>(0))
  applyForces()
}

// ------------------------------------------------------------------ view
// Everything is measured in visual pixels from getBoundingClientRect(), the
// same space as pointer events, so a zoomed page cannot shift the hit-testing.
const resize = () => {
  const rect = canvas.getBoundingClientRect()
  const nw = rect.width, nh = rect.height, nd = window.devicePixelRatio || 1
  if (!nw || !nh) return
  if (nw === W && nh === H && dpr === nd) return
  // Keep the same world point in the middle when the view changes size.
  if (W && H) { tx += (nw - W) / 2; ty += (nh - H) / 2; if (zoomTarget) { zoomTarget.tx += (nw - W) / 2; zoomTarget.ty += (nh - H) / 2 } }
  else { tx = nw / 2; ty = nh / 2 }
  W = nw; H = nh; dpr = nd
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
  dirty = true
}
const fit = () => {
  resize()
  if (!nodes.length) { k = 1; tx = W / 2; ty = H / 2; dirty = true; return }
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue
    if (n.x < minx) minx = n.x; if (n.x > maxx) maxx = n.x
    if (n.y < miny) miny = n.y; if (n.y > maxy) maxy = n.y
  }
  if (!isFinite(minx)) return
  const pad = compact ? 30 : 60
  const nk = Math.max(0.05, Math.min(2.5, Math.min((W - pad) / Math.max(1, maxx - minx), (H - pad) / Math.max(1, maxy - miny))))
  zoomTarget = { k: nk, tx: W / 2 - ((minx + maxx) / 2) * nk, ty: H / 2 - ((miny + maxy) / 2) * nk }
  if (appear === 0) { k = zoomTarget.k; tx = zoomTarget.tx; ty = zoomTarget.ty; zoomTarget = null } // first paint: no fly-in
  dirty = true
}
// Zooms ease toward their target over a few frames instead of jumping.
const zoomAt = (sx: number, sy: number, factor: number, immediate = false) => {
  const cur = immediate ? { k, tx, ty } : zoomTarget || { k, tx, ty }
  const wx = (sx - cur.tx) / cur.k, wy = (sy - cur.ty) / cur.k
  const nk = Math.max(0.05, Math.min(8, cur.k * factor))
  const next = { k: nk, tx: sx - wx * nk, ty: sy - wy * nk }
  if (immediate) { k = next.k; tx = next.tx; ty = next.ty; zoomTarget = null } else zoomTarget = next
  dirty = true
}
const zoomBy = (f: number) => zoomAt(W / 2, H / 2, f)
const approach = (v: number, target: number, step: number) => v < target ? Math.min(target, v + step) : Math.max(target, v - step)
const focusNode = () => hover || selected
const animate = (dt: number) => {
  if (zoomTarget) {
    const f = 1 - Math.exp(-dt / 70)
    k += (zoomTarget.k - k) * f; tx += (zoomTarget.tx - tx) * f; ty += (zoomTarget.ty - ty) * f
    if (Math.abs(zoomTarget.k - k) < 1e-4 && Math.abs(zoomTarget.tx - tx) < 0.2 && Math.abs(zoomTarget.ty - ty) < 0.2) {
      k = zoomTarget.k; tx = zoomTarget.tx; ty = zoomTarget.ty; zoomTarget = null
    }
    dirty = true
  }
  if (appear < 1) { appear = Math.min(1, appear + dt / 1200); dirty = true }
  const want = focusNode() ? 1 : 0
  if (hoverAnim !== want) { hoverAnim = approach(hoverAnim, want, dt / 260); dirty = true }
}

const draw = () => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.translate(tx, ty)
  ctx.scale(k, k)

  const hov = focusNode() || (hoverAnim > 0 ? fadeHover : null)
  const dimNode = 1 - 0.7 * hoverAnim      // non-neighbours fade to 30%
  const dimLink = 1 - 0.75 * hoverAnim
  const lw = (0.8 * S.display.linkThickness) / k
  // Links: one path per style so thousands of lines cost two strokes.
  const strokePath = (pred: (l: GLink) => boolean, color: string, width: number) => {
    ctx.beginPath()
    let any = false
    for (const l of links) {
      if (!pred(l)) continue
      const a = l.source as GNode, b = l.target as GNode
      if (a.x == null || b.x == null) continue
      ctx.moveTo(a.x, a.y!); ctx.lineTo(b.x, b.y!); any = true
    }
    if (any) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke() }
  }
  // Stated links stay quiet; the ones Graphify inferred carry a warm tint.
  // A link outside the legend's focus is drawn faint.
  const faint = (l: GLink) => (l.source as GNode).dim || (l.target as GNode).dim
  const touches = (l: GLink) => l.source === hov || l.target === hov
  const hubs = hubsOn()
  const isSpoke = (l: GLink) => hubs && l.spoke
  const quiet = hov ? appear * dimLink : appear
  if (focus !== null) {
    ctx.globalAlpha = quiet * 0.22
    strokePath((l) => faint(l) && !(hov && touches(l)), THEME.link, lw)
  }
  ctx.globalAlpha = quiet
  strokePath((l) => !l.inferred && !isSpoke(l) && !faint(l) && !(hov && touches(l)), THEME.link, lw)
  if (GRAPHIFY) strokePath((l) => l.inferred && !isSpoke(l) && !faint(l) && !(hov && touches(l)), THEME.inferred, lw * 1.25)
  // Spokes take their hub's colour, one stroke per colour, so a flower reads
  // as one thing and a leaf can be traced back to its hub at a glance.
  if (hubs) {
    const byColor = new Map<string, GLink[]>()
    for (const l of links) {
      if (!l.spoke || faint(l) || (hov && touches(l))) continue
      const a = l.source as GNode, b = l.target as GNode
      const hub = a.leafOf === b ? b : a
      const list = byColor.get(hub.color) || []
      list.push(l)
      byColor.set(hub.color, list)
    }
    ctx.globalAlpha = quiet * 0.5
    for (const [color, list] of byColor) {
      ctx.beginPath()
      for (const l of list) {
        const a = l.source as GNode, b = l.target as GNode
        if (a.x == null || b.x == null) continue
        ctx.moveTo(a.x, a.y!); ctx.lineTo(b.x, b.y!)
      }
      ctx.strokeStyle = color; ctx.lineWidth = lw * 1.2; ctx.stroke()
    }
  }
  if (hov) {
    ctx.globalAlpha = appear * hoverAnim
    strokePath(touches, ACCENT, lw * 1.6)
  }

  // Labels fade in with zoom; the threshold slider shifts where.
  const t0 = 0.9 * Math.pow(2, S.display.textFade)
  const labelAlpha = Math.max(0, Math.min(1, (k - t0) / (t0 * 0.6)))
  ctx.font = `${11 / k}px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const minX = -tx / k - 20, maxX = (W - tx) / k + 20, minY = -ty / k - 20, maxY = (H - ty) / k + 20
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue
    if (n.x < minX || n.x > maxX || n.y < minY || n.y > maxY) continue
    const near = !hov || n === hov || hov.nb.has(n)
    const base = n.dim && !(hov && near) ? 0.16 : 1
    ctx.globalAlpha = appear * base * (near ? 1 : dimNode)
    const r = Math.max(n === hov ? n.r * (1 + 0.25 * hoverAnim) : n.r, MIN_SCREEN_R / k)
    ctx.beginPath()
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
    ctx.fillStyle = n.color
    ctx.fill()
    if (hubs && n.hub && n !== hov) { ctx.lineWidth = 1.2 / k; ctx.strokeStyle = HUB_RING; ctx.stroke() }
    if (n === hov) { ctx.globalAlpha = appear * hoverAnim; ctx.lineWidth = 1.5 / k; ctx.strokeStyle = THEME.ring; ctx.stroke() }
    // A hub's name shows up at a lower zoom than the rest, so the flowers can be told apart.
    const ownAlpha = hubs && n.hub ? Math.max(labelAlpha, Math.min(1, (k - t0 * 0.35) / (t0 * 0.5))) : labelAlpha
    const la = hov && (n === hov || (near && hov.nb.size <= NEIGHBOUR_LABELS_MAX)) ? Math.max(ownAlpha, hoverAnim) : ownAlpha
    if (la > 0.02 && (near || ownAlpha > 0) && base === 1) {
      ctx.globalAlpha = appear * (near ? la : la * dimNode)
      ctx.fillStyle = near ? THEME.text : THEME.textDim
      if (hubs && n.hub) ctx.font = `600 ${11.5 / k}px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif`
      ctx.fillText(n.label, n.x, n.y + r + 2 / k)
      if (hubs && n.hub) ctx.font = `${11 / k}px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif`
    }
  }
  ctx.globalAlpha = 1
}

const loop = (now: number) => {
  if (destroyed) return
  requestAnimationFrame(loop)
  if (!sim) return
  const elapsed = lastFrame ? now - lastFrame : 16
  const dt = Math.min(50, elapsed)
  lastFrame = now
  if ((frameNo++ % 20) === 0) resize()
  if (settling) return
  // The animation keeps to the clock even when a heavy frame runs long.
  stepAnim(Math.min(250, elapsed))
  const active = nodes.length > 0 && (sim.alpha() > sim.alphaMin() || sim.alphaTarget() > 0 || dragNode !== null)
  // A note under the pointer holds still, so it can be clicked where it is.
  const held = hover !== null && dragNode === null
  if (active && !held) { sim.tick(); dirty = true; updateHover() }
  animate(dt)
  if (dirty) { draw(); dirty = false }
}

// --------------------------------------------------------------- pointer
const local = (cx: number, cy: number) => {
  const rect = canvas.getBoundingClientRect()
  const sx = cx - rect.left, sy = cy - rect.top
  return { sx, sy, x: (sx - tx) / k, y: (sy - ty) / k }
}
const pick = (x: number, y: number, grab = GRAB_PX): GNode | null => {
  let best: GNode | null = null, bd = Infinity
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue
    const dx = n.x - x, dy = n.y - y, rr = Math.max(n.r, MIN_SCREEN_R / k) + grab / k
    const d2 = dx * dx + dy * dy
    if (d2 < rr * rr && d2 < bd) { bd = d2; best = n }
  }
  return best
}
const setCursor = (c: 'grab' | 'grabbing' | 'pointer') => {
  canvas.classList.toggle('is-grabbing', c === 'grabbing')
  canvas.classList.toggle('is-pointer', c === 'pointer')
}

const select = (n: GNode | null) => {
  selected = n
  if (n) fadeHover = n
  cardEl.hidden = !n
  if (n) {
    $<HTMLElement>('.og__card-dot', cardEl).style.background = n.color
    $('.og__card-title', cardEl).textContent = n.label
    const where = n.path.replace(/^wiki\//, '').replace(/\.md$/, '') || 'no note'
    $('.og__card-sub', cardEl).textContent = n.kind === 'tag'
      ? `${n.deg} notes`
      : n.hub && hubsOn()
        ? `Hub · ${n.leaves} of its own · ${where}`
        : n.leafOf && hubsOn()
          ? `Part of ${n.leafOf.label}`
          : GRAPHIFY
            ? `${n.community || n.type || 'concept'} · ${where}`
            : `${where.replace(/\/[^/]*$/, '') || 'wiki'} · ${n.deg} links`
    const open = $<HTMLButtonElement>('.og__card-open', cardEl)
    open.textContent = n.kind === 'tag' ? 'Filter by tag' : n.note ? 'Open note' : 'No note'
    open.disabled = n.kind !== 'tag' && !n.note
  }
  dirty = true
}
const openNode = (n: GNode) => {
  if (n.kind === 'tag') { setSearch('tag:' + n.label.slice(1)); select(null); return }
  if (!n.note) return
  // A Graphify node is a concept inside its note: send its name so the note
  // opens at, and highlights, the passage that mentions it.
  host.open({ id: n.id, note: n.note, title: n.label, quote: GRAPHIFY ? n.label : '', path: n.path, raw: n.raw })
}

const pointers = new Map<number, { x: number; y: number }>()
let pinch: { dist: number; mx: number; my: number } | null = null
const pinchState = () => {
  const [a, b] = [...pointers.values()]
  return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
}
const releaseDrag = () => {
  if (dragNode) { dragNode.fx = null; dragNode.fy = null; dragNode = null; applyForces() }
  panning = false
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  canvas.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) { releaseDrag(); pinch = pinchState(); moved = true; return }
  if (pointers.size > 2) return
  const p = local(e.clientX, e.clientY)
  downX = lastX = e.clientX; downY = lastY = e.clientY; moved = false
  const hit = pick(p.x, p.y, e.pointerType === 'mouse' ? GRAB_PX : TOUCH_GRAB_PX)
  if (hit) {
    dragNode = hit; hit.fx = hit.x; hit.fy = hit.y
    if (sim) { sim.alphaTarget(DRAG_ALPHA); if (sim.alpha() < DRAG_ALPHA) sim.alpha(DRAG_ALPHA) }
  } else {
    panning = true
  }
  setCursor('grabbing')
})
canvas.addEventListener('pointermove', (e) => {
  const tracked = pointers.get(e.pointerId)
  if (tracked) { tracked.x = e.clientX; tracked.y = e.clientY }
  if (pinch && pointers.size >= 2) {
    const now = pinchState()
    const m = local(now.mx, now.my)
    zoomAt(m.sx, m.sy, now.dist / pinch.dist, true)
    tx += now.mx - pinch.mx; ty += now.my - pinch.my
    pinch = now
    dirty = true
    return
  }
  if (!tracked) {
    // Plain hover: only a mouse has one.
    if (e.pointerType === 'mouse') { lastMove = { x: e.clientX, y: e.clientY }; updateHover() }
    return
  }
  const dx = e.clientX - lastX, dy = e.clientY - lastY
  lastX = e.clientX; lastY = e.clientY
  if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > (e.pointerType === 'mouse' ? 3 : 8)) moved = true
  if (dragNode) {
    if (!moved) return
    const p = local(e.clientX, e.clientY)
    dragNode.fx = p.x; dragNode.fy = p.y
    dirty = true
  } else if (panning) {
    tx += dx; ty += dy
    if (zoomTarget) { zoomTarget.tx += dx; zoomTarget.ty += dy }
    dirty = true
  }
})
const onPointerEnd = (e: PointerEvent) => {
  if (!pointers.has(e.pointerId)) return
  pointers.delete(e.pointerId)
  if (pinch) {
    if (pointers.size < 2) pinch = null
    if (pointers.size === 1) { const [p] = [...pointers.values()]; lastX = p.x; lastY = p.y; panning = true }
    return
  }
  const clicked = dragNode && !moved ? dragNode : null
  const tappedEmpty = panning && !moved
  releaseDrag()
  if (e.pointerType === 'mouse') {
    lastMove = { x: e.clientX, y: e.clientY }
    updateHover()
    if (clicked && e.type === 'pointerup') openNode(clicked)
  } else {
    setCursor('grab')
    if (clicked) select(selected === clicked ? null : clicked)
    else if (tappedEmpty) select(null)
  }
  dirty = true
}
canvas.addEventListener('pointerup', onPointerEnd)
canvas.addEventListener('pointercancel', onPointerEnd)
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType !== 'mouse' || pointers.size) return
  lastMove = null
  if (hover) { hover = null; dirty = true }
})
const updateHover = () => {
  if (!lastMove || dragNode || panning || pinch) return
  const p = local(lastMove.x, lastMove.y)
  const hit = pick(p.x, p.y)
  if (hit !== hover) { hover = hit; if (hit) fadeHover = hit; dirty = true }
  setCursor(hit ? 'pointer' : 'grab')
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  const p = local(e.clientX, e.clientY)
  // A trackpad pinch arrives as a wheel event with ctrlKey and small deltas.
  zoomAt(p.sx, p.sy, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0015)))
}, { passive: false })
canvas.addEventListener('dblclick', (e) => {
  const p = local(e.clientX, e.clientY)
  if (!pick(p.x, p.y)) fit()
})
// Safari's own pinch gesture on macOS, where no ctrl-wheel is sent.
let gestureScale = 1
canvas.addEventListener('gesturestart' as any, (e: any) => { e.preventDefault(); gestureScale = e.scale || 1 })
canvas.addEventListener('gesturechange' as any, (e: any) => {
  e.preventDefault()
  const p = local(e.clientX ?? W / 2, e.clientY ?? H / 2)
  zoomAt(p.sx, p.sy, (e.scale || 1) / gestureScale, true)
  gestureScale = e.scale || 1
})

$('.og__card-open', cardEl).addEventListener('click', () => { if (selected) openNode(selected) })
app.querySelectorAll<HTMLButtonElement>('.og__zoom button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.act === 'zin') zoomBy(1.25)
  else if (b.dataset.act === 'zout') zoomBy(0.8)
  else fit()
}))
gearEl.addEventListener('click', () => showPanel(true))

// ---------------------------------------------------------------- legend
// What the colours mean, and a way to look at one meaning at a time.
const legendRow = (key: string, label: string, color: string, count: number, hint = '') => `
<div class="og__lrow${focus === key ? ' is-focus' : ''}${focus !== null && focus !== key ? ' is-dim' : ''}" data-focus="${escapeHtml(key)}"${hint ? ` title="${escapeHtml(hint)}"` : ''}>
  <span class="og__lswatch" style="background:${color}"></span>
  <span class="og__llabel">${escapeHtml(label)}</span>
  <span class="og__ln">${count.toLocaleString()}</span>
</div>`
// It lives in the settings panel, as its own section (Graphify only).
const renderLegend = () => {
  const legendEl = panelEl.querySelector<HTMLElement>('[data-legend-body]')
  if (!legendEl) return
  const modes: [ColorMode, string][] = [['community', 'Community'], ['kind', 'Kind'], ['groups', 'Folder']]
  let body = ''
  if (S.colorBy === 'community') {
    const ranked = [...communityRank.entries()].sort((a, b) => a[1] - b[1])
    const top = ranked.slice(0, LEGEND_ROWS)
    const rest = ranked.length - top.length
    const restNodes = ranked.slice(LEGEND_ROWS).reduce((sum, [name]) => sum + (communitySize.get(name) || 0), 0)
    body = top.map(([name]) => legendRow(name, name, communityColor(name), communitySize.get(name) || 0)).join('')
      + (rest > 0 ? `<div class="og__lrow is-static"><span class="og__lswatch" style="background:${mix(BRIGHT[0], BRIGHT_BASE, 0.35)}"></span><span class="og__llabel">${rest} smaller communities</span><span class="og__ln">${restNodes.toLocaleString()}</span></div>` : '')
      + `<div class="og__lhint">A community is a group of ideas that Graphify found belong together. Click one to see it alone; search <b>community:name</b> for the smaller ones.</div>`
  } else if (S.colorBy === 'kind') {
    body = Object.keys(KIND_LABEL).filter((kind) => kindSize.get(kind)).map((kind) => legendRow(kind, KIND_LABEL[kind], KIND_COLOR[kind], kindSize.get(kind) || 0, KIND_HINT[kind])).join('')
      + `<div class="og__lhint">Notes are your files. Everything else was found inside one of them.</div>`
  } else {
    body = `<div class="og__lhint">Colours come from the Groups panel, by the folder of the note each node came from.</div>`
  }
  legendEl.innerHTML = `
    <div>
      <div class="og__lmodes">${modes.map(([m, label]) => `<button type="button" class="og__lmode${S.colorBy === m ? ' is-active' : ''}" data-mode="${m}">${label}</button>`).join('')}</div>
      ${body}
      <div class="og__lkey"><span class="og__lline"></span>stated in a note</div>
      <div class="og__lkey"><span class="og__lline og__lline--inferred"></span>inferred by Graphify</div>
      ${hubsOn() ? '<div class="og__lkey"><span class="og__lhub"></span>a note, with the ideas found in it drawn in its colour</div>' : ''}
    </div>`
}
panelEl.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-mode],[data-focus]')
  if (!t) return
  if (t.dataset.mode) {
    S.colorBy = t.dataset.mode as ColorMode
    focus = null
    // Folder colouring needs groups to colour by; bring the folder set back.
    if (S.colorBy === 'groups' && !S.groups.length) { S.groups.push(...SRC.groups.map((g) => ({ ...g }))); renderGroups() }
  } else if (t.dataset.focus != null) {
    focus = focus === t.dataset.focus ? null : t.dataset.focus
  }
  persist()
  recolor()
  renderLegend()
})

// -------------------------------------------------------------- settings
let rebuildTimer: ReturnType<typeof setTimeout> | null = null
const scheduleRebuild = () => { if (rebuildTimer) clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 150) }
const setSearch = (value: string) => {
  S.search = value
  persist()
  const input = panelEl.querySelector<HTMLInputElement>('[data-bind="search"]')
  if (input) input.value = value
  syncClear()
  scheduleRebuild()
}
const syncClear = () => {
  const clear = panelEl.querySelector<HTMLElement>('.og__clear')
  if (clear) clear.style.display = S.search ? '' : 'none'
}

const section = (id: Section, title: string, body: string, tools = '') => `
<section class="og__sec${S.open[id] ? '' : ' is-closed'}" data-sec="${id}">
  <header class="og__sec-h">
    <button type="button" class="og__sec-t" data-toggle="${id}">${S.open[id] ? icons.chevronDown : icons.chevronRight}${title}</button>
    ${tools}
  </header>
  <div class="og__sec-b">${body}</div>
</section>`
const toggleRow = (label: string, key: string, on: boolean) => `
<label class="og__row"><span>${label}</span><span class="og__switch"><input type="checkbox" data-switch="${key}"${on ? ' checked' : ''}><span></span></span></label>`
const sliderRow = (label: string, key: string, value: number, min: number, max: number, step: number) => `
<label class="og__slider"><span>${label}</span><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`
// Offered only when the graph is large enough for a cap to matter.
const limitRow = () => {
  const total = data?.nodes.length || 0
  if (total <= LIMIT_OPTIONS[0]) return ''
  const options = LIMIT_OPTIONS.filter((n) => n < total).map((n) => `<option value="${n}"${S.limit === n ? ' selected' : ''}>Top ${n.toLocaleString()}</option>`).join('')
  return `<label class="og__row"><span>Show</span><select class="og__select" data-select="limit">${options}<option value="0"${S.limit === 0 || S.limit >= total ? ' selected' : ''}>All ${total.toLocaleString()}</option></select></label>`
}
const groupRows = () => S.groups.map((g, i) => `
<div class="og__group" data-group="${i}">
  <input type="text" class="og__group-q" data-group-q="${i}" value="${escapeHtml(g.query)}" placeholder="${GRAPHIFY ? 'path:concepts, community:name, type:paper …' : 'path:concepts, tag:name …'}" spellcheck="false" autocapitalize="off" autocorrect="off">
  <label class="og__swatch" style="background:${escapeHtml(g.color)}" title="Colour"><input type="color" data-group-c="${i}" value="${escapeHtml(g.color)}"></label>
  <button type="button" class="og__x" data-group-x="${i}" title="Remove group">${icons.close}</button>
</div>`).join('') + `<button type="button" class="og__new" data-act="new-group">New group</button>`

const renderPanel = () => {
  panelEl.innerHTML =
    section('filters', 'Filters', `
      <label class="og__search">${icons.search}
        <input type="text" data-bind="search" value="${escapeHtml(S.search)}" placeholder="Search files…" spellcheck="false" autocapitalize="off" autocorrect="off">
        <button type="button" class="og__clear" title="Clear">${icons.close}</button>
      </label>
      <div class="og__hint">path:folder &nbsp; file:name &nbsp; ${GRAPHIFY ? 'community:name &nbsp; type:concept' : 'tag:name'} &nbsp; -not &nbsp; "exact phrase"</div>
      ${GRAPHIFY ? '' : toggleRow('Tags', 'tags', S.tags)}
      ${toggleRow('Orphans', 'orphans', S.orphans)}
      ${limitRow()}`,
    `<span class="og__sec-tools">
        <button type="button" data-act="reset" title="Restore default settings">${icons.reset}</button>
        <button type="button" data-act="close" title="Close">${icons.close}</button>
      </span>`) +
    (GRAPHIFY && data?.nodes.length ? section('legend', 'Colour by', '<div data-legend-body></div>') : '') +
    section('groups', 'Groups', `<div data-groups style="display:flex;flex-direction:column;gap:10px">${groupRows()}</div>`) +
    section('display', 'Display',
      sliderRow('Node size', 'display.nodeSize', S.display.nodeSize, 0.1, 5, 0.1) +
      sliderRow('Link thickness', 'display.linkThickness', S.display.linkThickness, 0.1, 5, 0.1) +
      sliderRow('Text fade threshold', 'display.textFade', S.display.textFade, -3, 3, 0.1) +
      toggleRow('Show hubs', 'hubs', S.display.hubs) +
      toggleRow('Gentle motion', 'motion', S.display.motion)) +
    section('forces', 'Forces',
      `<div class="og__row"><span>Animate</span><div class="og__transport" role="group" aria-label="Force animation" data-transport></div></div>
      <div class="og__hint">Centre force runs from 40% to the maximum while repel runs from 100% down to 20%, then back.</div>` +
      sliderRow('Center force', 'forces.center', S.forces.center, 0, 1, 0.01) +
      sliderRow('Repel force', 'forces.repel', S.forces.repel, 0, 20, 0.1) +
      sliderRow('Link force', 'forces.link', S.forces.link, 0, 1, 0.01) +
      sliderRow('Link distance', 'forces.linkDistance', S.forces.linkDistance, 30, 500, 1))
  syncClear()
  renderTransport()
  renderLegend()
}
const renderGroups = () => {
  const el = panelEl.querySelector<HTMLElement>('[data-groups]')
  if (el) el.innerHTML = groupRows()
}

panelEl.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-toggle],[data-act],[data-anim],[data-group-x],.og__clear')
  if (!t) return
  if (t.dataset.anim) {
    const act = t.dataset.anim
    if (act === 'play') playAnim()
    else if (act === 'pause') pauseAnim()
    else if (act === 'stop') stopAnim()
    else changeAnimSpeed(act === 'faster' ? 1 : -1)
  } else if (t.dataset.toggle) {
    const id = t.dataset.toggle as Section
    S.open[id] = !S.open[id]
    const sec = panelEl.querySelector<HTMLElement>(`[data-sec="${id}"]`)!
    sec.classList.toggle('is-closed', !S.open[id])
    t.innerHTML = (S.open[id] ? icons.chevronDown : icons.chevronRight) + escapeHtml(t.textContent || '')
    persist()
  } else if (t.dataset.act === 'close') {
    showPanel(false)
  } else if (t.dataset.act === 'reset') {
    anim.state = 'stopped'; anim.base = null; anim.from = null
    Object.assign(S, defaults(), { open: S.open })
    focus = null
    renderPanel(); rebuild(); renderLegend(); applyForces(); sim?.alpha(Math.max(sim.alpha(), 0.3)); persist()
    if (S.animate.playing) playAnim()
  } else if (t.dataset.act === 'new-group') {
    S.groups.push({ query: '', color: NEW_GROUP_COLORS[S.groups.length % NEW_GROUP_COLORS.length] })
    renderGroups(); persist()
    panelEl.querySelector<HTMLInputElement>(`[data-group-q="${S.groups.length - 1}"]`)?.focus()
  } else if (t.dataset.groupX != null) {
    S.groups.splice(Number(t.dataset.groupX), 1)
    renderGroups(); recolor(); persist()
  } else if (t.classList.contains('og__clear')) {
    setSearch('')
  }
})
panelEl.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement
  if (t.dataset.bind === 'search') { S.search = t.value; syncClear(); scheduleRebuild(); persist(); return }
  if (t.dataset.groupQ != null) { S.groups[Number(t.dataset.groupQ)].query = t.value; recolor(); persist(); return }
  if (t.dataset.groupC != null) {
    S.groups[Number(t.dataset.groupC)].color = t.value
    ;(t.parentElement as HTMLElement).style.background = t.value
    recolor(); persist(); return
  }
  if (t.dataset.range) {
    const [a, b] = t.dataset.range.split('.') as ['display' | 'forces', string]
    if (a === 'forces' && (b === 'center' || b === 'repel')) abandonAnim()
    ;(S[a] as any)[b] = Number(t.value)
    if (a === 'forces') { applyForces(); sim?.alpha(Math.max(sim.alpha(), 0.3)) }
    else if (b === 'nodeSize') resize_nodes()
    dirty = true
    persist()
  }
})
panelEl.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement
  if (t.dataset.select === 'limit') {
    S.limit = Number(t.value) || 0
    posCache.clear()
    rebuild()
    persist()
    void settle().then(fit)
    return
  }
  if (!t.dataset.switch) return
  if (t.dataset.switch === 'tags') { S.tags = t.checked; scheduleRebuild() }
  else if (t.dataset.switch === 'orphans') { S.orphans = t.checked; scheduleRebuild() }
  else if (t.dataset.switch === 'motion') { S.display.motion = t.checked; applyForces() }
  else if (t.dataset.switch === 'hubs') {
    S.display.hubs = t.checked
    resize_nodes(); applyForces(); renderLegend()
    if (sim) sim.alpha(Math.max(sim.alpha(), 0.3))
    dirty = true
  }
  persist()
})

// ------------------------------------------------------------------ boot
const start = async () => {
  setupSim()
  renderPanel()
  showPanel(panelOpen)
  resize()
  resizeObserver.observe(canvas)
  requestAnimationFrame(loop)
  try {
    // The host may hand over the source it expects the page to open on.
    if (opts.initialData) dataCache.set(SRC.id, opts.initialData as RawGraph)
    renderSource()
    await showSource()
    host.notify?.('ready', { nodes: data?.nodes.length || 0, links: links.length })
  } catch (err) {
    fail(err)
  }
}
const fail = (err: unknown) => {
  msgEl.style.display = ''
  msgEl.textContent = 'Could not load the graph.'
  host.notify?.('failed', { message: err instanceof Error ? err.message : 'unknown' })
}

// ------------------------------------------------------------ source switch
const dataCache = new Map<string, RawGraph>()
let switching = false
const sourceEl = app.appendChild(Object.assign(document.createElement('div'), { className: 'og__source' }))
sourceEl.setAttribute('role', 'group')
sourceEl.setAttribute('aria-label', 'Graph')
// A single source needs no switch.
const renderSource = () => {
  sourceEl.hidden = SOURCES.length < 2
  sourceEl.innerHTML = SOURCES.map((src) => `
    <button type="button" class="og__srcb${src === SRC ? ' is-active' : ''}" data-source="${escapeHtml(src.id)}"${src.title ? ` title="${escapeHtml(src.title)}"` : ''}${switching ? ' disabled' : ''}>${escapeHtml(src.label)}</button>`).join('')
}
// Load (or reuse) the current source's graph, then lay it out and fit it.
const showSource = async () => {
  const src = SRC
  let g = dataCache.get(src.id)
  if (!g) {
    msgEl.style.display = ''
    msgEl.textContent = src.loadingText || 'Reading the graph…'
    g = await host.request<RawGraph>('graph', { source: src.id })
    if (!g || !Array.isArray(g.nodes)) throw new Error('no graph data')
    dataCache.set(src.id, g)
  }
  if (destroyed || src !== SRC) return
  data = g
  msgEl.style.display = data.nodes.length ? 'none' : ''
  if (!data.nodes.length) msgEl.textContent = src.emptyText || 'There is nothing to draw yet.'
  indexMeaning()
  renderPanel() // the node limit row and the Tags switch depend on the source
  renderLegend()
  applyForces()
  rebuild()
  resize()
  await settle() // then it drifts gently
  fit()
  // Pick the animation back up if it was running when the graph was last left.
  if (S.animate.playing && anim.state !== 'playing') playAnim()
}
const switchSource = async (next: GraphSource | undefined) => {
  if (!next || next === SRC || switching) return
  switching = true
  // Leave the current source's settings as the user had them.
  if (anim.state !== 'stopped') {
    if (anim.base) { S.forces.center = anim.base.center; S.forces.repel = anim.base.repel }
    persist()
    anim.state = 'stopped'; anim.base = null; anim.from = null
  } else persist()
  useSource(next)
  host.saveSetting(SOURCE_KEY, next.id)
  Object.assign(S, loadSettings())
  focus = null
  select(null)
  hover = null; fadeHover = null; dragNode = null
  posCache.clear()
  data = null
  rebuild()
  renderSource()
  try { await showSource() } catch (err) { fail(err) }
  switching = false
  renderSource()
}
sourceEl.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-source]')
  if (t) void switchSource(sourceById(t.dataset.source))
})

// Debugging handle for the Web Inspector.
;(host.debug ? (window as any) : {}).__kg2d = { sim: () => sim, nodes: () => nodes, links: () => links, draw, fit, view: () => ({ k, tx, ty, W, H }), hover: () => hover, selected: () => selected, settings: () => S, anim: () => ({ ...anim }), source: () => SRC.id, switchSource: (id: string) => switchSource(sourceById(id)),
  // Advances the animation and the layout by hand, for a hidden page whose frames are paused.
  step: (ms: number) => { stepAnim(ms); sim?.tick(); dirty = true } }

const resizeObserver = new ResizeObserver(() => resize())
const destroy = () => {
  if (destroyed) return
  destroyed = true
  resizeObserver.disconnect()
  sim?.stop()
  sim = null
  if (rebuildTimer) clearTimeout(rebuildTimer)
  app.innerHTML = ''
  if ((window as any).__kg2d?.page === page) delete (window as any).__kg2d
}
const page: GraphPage = { destroy }
if (host.debug) (window as any).__kg2d.page = page
start()
return page
}
