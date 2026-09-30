// 3D Knowledge Graph: the links between notes (or the Graphify graph) as a live 3D force
// layout. Learned from the Obsidian "3D Graph" plugin by AlexW00 (MIT), which
// builds on 3d-force-graph's highlight example: hovering a note lights it, its
// neighbours and its links, with particles running along those links; a click
// opens the note; a local graph shows one note's neighbourhood; Filters,
// Groups and Display settings. Added here: a Forces section, shaded spheres,
// name labels on the lit neighbourhood, orbit transport, a depth control for
// the local graph, and the Graphify graph as a second source.
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { escapeHtml, icons, injectStyle, type GraphHost, type GraphPage, type GraphSource, type Group } from '../host'
// @ts-expect-error bundled as text by esbuild
import css from './force3d.css'

type ColorMode = 'groups' | 'community'
type Section = 'filters' | 'groups' | 'display' | 'forces'
interface Settings {
  v: number
  source: string
  colorBy: ColorMode
  search: string; orphans: boolean
  /** Graphify only: draw the N most connected nodes; 0 draws everything. The link graph is always drawn whole. */
  limit: number
  groups: Group[]
  display: { nodeSize: number; linkThickness: number; linkOpacity: number; particleSize: number; particleCount: number; labels: boolean }
  forces: { center: number; repel: number; linkDistance: number }
  orbit: boolean; speed: number
  depth: number
  open: Record<Section, boolean>
}
interface RawNode {
  id: string; title: string; linkCount: number; path?: string; tags?: string[]
  note?: string | null; communityName?: string; type?: string
}
export interface Force3DOptions {
  /** The graphs this page can draw; the first is the default and gives the default colours. */
  sources: GraphSource[]
  /** Where this page's settings are kept. */
  settingsKey: string
  /** The first source's graph, when the host already has it. */
  initialData?: unknown
}
interface RawGraph { nodes: RawNode[]; edges: { from: string; to: string; inferred?: boolean }[] }
interface GNode {
  id: string; label: string; path: string; tags: string[]
  /** The note a click opens (a note path), or null when there is none. */
  note: string | null
  community: string; type: string
  labelLower: string; pathLower: string; tagsLower: string[]; communityLower: string
  linkCount: number
  deg: number; color: string
  x?: number; y?: number; z?: number; vx?: number; vy?: number; vz?: number
  __threeObj?: THREE.Mesh
  /** The node as the host delivered it; handed back when it is opened. */
  raw?: RawNode
}
interface GLink { source: string | GNode; target: string | GNode; inferred: boolean }
interface Term { field: 'any' | 'path' | 'file' | 'tag' | 'community' | 'type'; value: string; neg: boolean }

export function mount3D(root: HTMLElement, host: GraphHost, opts: Force3DOptions): GraphPage {
const compact = host.compact
let destroyed = false
const SOURCES = opts.sources
const sourceById = (id: unknown) => SOURCES.find((x) => x.id === id)
const SETTINGS_KEY = opts.settingsKey
const SETTINGS_VERSION = 1
const LIMIT_OPTIONS = [400, 800, 1500, 3000]
const SPEED_STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16]
const DEPTH_MAX = 4
const LABELS_MAX = compact ? 16 : 40  // a hub with more neighbours than this labels only itself
const BG = '#101216'
const NODE_GREY = '#9aa1ad'
const DIM_NODE = '#2b303b'
const LINK = 'rgba(160,170,196,0.55)'
const LINK_DIM = 'rgba(120,128,150,0.12)'
const LINK_INFERRED = 'rgba(255,214,120,0.55)'
const ACCENT = host.accent || '#8b7cf6'
const NEW_GROUP_COLORS = ['#e05252', '#e0b152', '#b1e052', '#52e052', '#52e0b1', '#52b1e0', '#5a5ae2', '#b152e0', '#e052b1', '#f28c3a']
const BRIGHT = ['#e05252', '#e0b152', '#52e052', '#52e0b1', '#52b1e0', '#5a5ae2', '#b152e0', '#e052b1', '#f28c3a', '#a8e04a', '#4fb3e8', '#e84fb0', '#ffe066', '#6f8bff']

// ------------------------------------------------------------- settings
const defaults = (): Settings => ({
  v: SETTINGS_VERSION, source: SOURCES[0].id, colorBy: 'groups', search: '', orphans: true,
  limit: compact ? 600 : 1500,
  groups: SOURCES[0].groups.map((g) => ({ ...g })),
  display: { nodeSize: 1, linkThickness: 0, linkOpacity: 0.5, particleSize: 2, particleCount: 3, labels: true },
  forces: { center: 0.3, repel: 10, linkDistance: 40 },
  orbit: true, speed: 1, depth: 1,
  open: { filters: true, groups: !compact, display: false, forces: false },
})
const loadSettings = (): Settings => {
  const d = defaults()
  try {
    const raw = host.loadSetting(SETTINGS_KEY)
    if (!raw) return d
    const s = JSON.parse(raw)
    return {
      ...d, ...s, v: SETTINGS_VERSION, search: typeof s.search === 'string' ? s.search : '',
      source: sourceById(s.source) ? s.source : SOURCES[0].id,
      colorBy: s.colorBy === 'community' ? 'community' : 'groups',
      limit: typeof s.limit === 'number' && s.limit >= 0 ? s.limit : d.limit,
      speed: SPEED_STEPS.includes(s.speed) ? s.speed : d.speed,
      depth: Number.isInteger(s.depth) ? Math.max(1, Math.min(DEPTH_MAX, s.depth)) : d.depth,
      display: { ...d.display, ...(s.display || {}) },
      forces: { ...d.forces, ...(s.forces || {}) },
      open: { ...d.open, ...(s.open || {}) },
      groups: Array.isArray(s.groups)
        ? s.groups.filter((g: any) => g && typeof g.query === 'string' && typeof g.color === 'string')
        : d.groups,
    }
  } catch { return d }
}
const S: Settings = loadSettings()
const persist = () => host.saveSetting(SETTINGS_KEY, S)

// ------------------------------------------------------------ query language
// The Graph's: terms are ANDed; path:, file:, tag:, community:, type: fields;
// -term negates; "quoted phrases" keep spaces.
const parseQuery = (q: string): Term[] => {
  const terms: Term[] = []
  const re = /(-)?(?:(path|file|tag|community|type):)?(?:"([^"]*)"|(\S+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(q))) {
    const value = (m[3] ?? m[4] ?? '').toLowerCase()
    if (value) terms.push({ neg: !!m[1], field: (m[2] as Term['field']) || 'any', value })
  }
  return terms
}
const matchTerm = (n: GNode, term: Term) => {
  const v = term.value.replace(/^#/, '')
  let hit: boolean
  switch (term.field) {
    case 'path': hit = n.pathLower.includes(term.value); break
    case 'file': hit = n.labelLower.includes(term.value); break
    case 'tag': hit = n.tagsLower.some((x) => x === v || x.startsWith(v + '/')); break
    case 'community': hit = n.communityLower.includes(term.value); break
    case 'type': hit = n.type === term.value; break
    default: hit = n.labelLower.includes(term.value) || n.pathLower.includes(term.value)
      || n.tagsLower.some((x) => x.includes(v)) || n.communityLower.includes(term.value)
  }
  return term.neg ? !hit : hit
}
const matchesAll = (n: GNode, terms: Term[]) => terms.every((t) => matchTerm(n, t))

// ------------------------------------------------------------------- DOM
injectStyle('graph-force3d-css', css)
const app = root
app.innerHTML = `
<div class="g3${compact ? ' is-compact' : ''}">
  <div class="g3__canvas"></div>
  <div class="g3__msg">Loading the 3D graph…</div>
  <div class="g3__hud"></div>
  <div class="g3__top"></div>
  <div class="g3__dock"></div>
  <button type="button" class="g3__gear" title="Graph settings">${icons.gear}</button>
  <aside class="g3__panel"></aside>
  <div class="g3__card" hidden></div>
</div>`
const $ = <T extends HTMLElement>(sel: string) => app.querySelector(sel) as T
const canvasEl = $('.g3__canvas')
const msgEl = $('.g3__msg')
const hudEl = $('.g3__hud')
const topEl = $('.g3__top')
const dockEl = $('.g3__dock')
const gearEl = $<HTMLButtonElement>('.g3__gear')
const panelEl = $('.g3__panel')
const cardEl = $('.g3__card')

let panelOpen = !compact
const showPanel = (open: boolean) => {
  panelOpen = open
  panelEl.style.display = open ? '' : 'none'
  gearEl.style.display = open ? 'none' : ''
}

// ----------------------------------------------------------------- state
const cache = new Map<string, RawGraph>()
let data: RawGraph | null = null
let fg: any = null
let resizeObserver: ResizeObserver | null = null
let loading = false
/** Node objects live across rebuilds, so a filter change keeps the layout. */
const nodeCache = new Map<string, GNode>()
let shown: GNode[] = []
let shownLinks: GLink[] = []
const neighbours = new Map<GNode, Set<GNode>>()
const linksOf = new Map<GNode, GLink[]>()
let hoverNode: GNode | null = null
let hoverLink: GLink | null = null
let selected: GNode | null = null
/** The note a local graph is drawn around, or null for the whole graph. */
let localRoot: string | null = null
const litNodes = new Set<GNode>()
const litLinks = new Set<GLink>()
let labelled: CSS2DObject[] = []
let communityRank = new Map<string, number>()
/** Set once the viewer moves the camera, so the first fit does not fight them. */
let viewerMoved = false
let firstFitTimer: ReturnType<typeof setTimeout> | null = null

// Only a mouse or trackpad hovers. A finger also sends hover events on its way
// to a tap, which would light a different note from the one it selects.
let pointerKind = host.platform === 'ios' ? 'touch' : 'mouse'
const hovering = () => pointerKind === 'mouse' || pointerKind === 'pen'
const ends = (l: GLink) => [l.source as GNode, l.target as GNode] as const
const currentSource = () => sourceById(S.source) || SOURCES[0]
const isGraphify = () => !!currentSource().graphify
const noun = () => currentSource().noun || (isGraphify() ? 'nodes' : 'notes')

// ---------------------------------------------------------------- colour
const isFolderGroup = (q: string) => /^path:wiki\/[\w-]+$/.test(q.trim())
const communityColor = (name: string) => {
  const rank = communityRank.get(name)
  if (rank == null) return NODE_GREY
  return BRIGHT[rank % BRIGHT.length]
}
let compiledGroups: { terms: Term[]; color: string; folder: boolean }[] = []
const compileGroups = () => {
  compiledGroups = S.groups.map((g) => ({ terms: parseQuery(g.query), color: g.color, folder: isFolderGroup(g.query) }))
}
const baseColor = (n: GNode) => {
  const community = isGraphify() && S.colorBy === 'community'
  for (const g of compiledGroups) {
    if (!g.terms.length || (community && g.folder)) continue
    if (matchesAll(n, g.terms)) return g.color
  }
  return community ? communityColor(n.community) : NODE_GREY
}
const focusNode = () => hoverNode || selected
const nodeColor = (n: GNode) => {
  if (!litNodes.size) return n.color
  if (n === focusNode()) return '#ffffff'
  return litNodes.has(n) ? n.color : DIM_NODE
}

// ---------------------------------------------------------------- engine
const nodeRadius = (n: GNode) => (1.8 + Math.log2(1 + n.deg) * 0.9) * S.display.nodeSize
// Fewer segments on a phone: a thousand spheres are a lot of triangles there.
const sphereGeom = new THREE.SphereGeometry(1, compact ? 14 : 24, compact ? 10 : 18)
const nodeSphere = (n: GNode) => {
  const mat = new THREE.MeshPhongMaterial({ color: nodeColor(n), shininess: 70, specular: new THREE.Color(0x555555), transparent: true, opacity: 1 })
  const mesh = new THREE.Mesh(sphereGeom, mat)
  const r = nodeRadius(n)
  mesh.scale.set(r, r, r)
  return mesh
}
const rotateSpeedFor = (s: number) => s / 2   // 1× is one turn every two minutes
const secondsPerTurn = () => Math.round((120 / S.speed) * 10) / 10

// A pull toward the middle in all three axes, scaled by the Center force slider.
const gravity = () => {
  let nodes: GNode[] = []
  const force = (alpha: number) => {
    const k = S.forces.center * 0.08 * alpha
    for (const n of nodes) { n.vx! -= (n.x || 0) * k; n.vy! -= (n.y || 0) * k; n.vz! -= (n.z || 0) * k }
  }
  force.initialize = (ns: GNode[]) => { nodes = ns }
  return force
}
const applyForces = () => {
  if (!fg) return
  fg.d3Force('charge').strength(-S.forces.repel * 6)
  fg.d3Force('link').distance(S.forces.linkDistance)
}

const ensureGraph = () => {
  if (fg) return
  const labels = new CSS2DRenderer()
  labels.domElement.style.pointerEvents = 'none'
  fg = new (ForceGraph3D as any)(canvasEl, { controlType: 'orbit', extraRenderers: [labels] })
    .backgroundColor(BG)
    .showNavInfo(false)
    .nodeId('id')
    .nodeLabel((n: GNode) => !hovering() ? '' : `<div class="g3__tip">${escapeHtml(n.label)}${n.path ? `<small>${escapeHtml(n.path.replace(/^wiki\//, '').replace(/\/[^/]*$/, ''))}</small>` : ''}</div>`)
    .nodeThreeObject((n: GNode) => nodeSphere(n))
    .linkColor((l: GLink) => litLinks.has(l) ? ACCENT : litNodes.size ? LINK_DIM : l.inferred ? LINK_INFERRED : LINK)
    .linkWidth((l: GLink) => litLinks.has(l) ? Math.max(1.2, S.display.linkThickness * 1.5) : S.display.linkThickness)
    .linkOpacity(S.display.linkOpacity)
    .linkDirectionalParticles((l: GLink) => litLinks.has(l) ? S.display.particleCount : 0)
    .linkDirectionalParticleWidth(S.display.particleSize)
    .linkDirectionalParticleSpeed(0.006)
    .linkDirectionalParticleColor(() => ACCENT)
    // Gentle: the layout blooms out from the middle and glides to rest.
    .d3AlphaDecay(0.015)
    .d3VelocityDecay(0.55)
    .warmupTicks(0)
    .cooldownTime(20000)
    .onNodeHover((n: GNode | null) => {
      if (!hovering()) n = null
      if (n === hoverNode) return
      hoverNode = n
      hoverLink = null
      canvasEl.style.cursor = n ? 'pointer' : ''
      light()
    })
    .onLinkHover((l: GLink | null) => {
      if (!hovering()) l = null
      if (hoverNode || l === hoverLink) return
      hoverLink = l
      light()
    })
    // With a pointer a click opens the note, as in the plugin (it opens beside
    // the graph on the Mac). A tap selects first; the card carries Open note.
    .onNodeClick((n: GNode) => {
      select(n)
      if (hovering()) openNode(n)
    })
    .onBackgroundClick(() => select(null))
  for (const type of ['pointerdown', 'pointermove'] as const) {
    canvasEl.addEventListener(type, (e) => { pointerKind = e.pointerType || 'mouse' }, { capture: true, passive: true })
  }
  canvasEl.addEventListener('pointerdown', () => { viewerMoved = true }, { capture: true, passive: true })
  canvasEl.addEventListener('wheel', () => { viewerMoved = true }, { capture: true, passive: true })
  fg.d3Force('gravity', gravity())
  applyForces()
  // Soft ambient light plus key and fill lights shade the spheres.
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(1, 1.4, 1.2)
  const fill = new THREE.DirectionalLight(0xdfe7ff, 0.8)
  fill.position.set(-1.4, -0.6, -1)
  fg.lights([new THREE.AmbientLight(0xffffff, 1.1), key, fill, new THREE.HemisphereLight(0xffffff, 0x333344, 0.5)])
  const controls = fg.controls()
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.autoRotate = S.orbit
  controls.autoRotateSpeed = rotateSpeedFor(S.speed)
  resizeObserver = new ResizeObserver(() => fitSize())
  resizeObserver.observe(canvasEl)
  fitSize()
}
// Unlinked notes drift far out under the repel force; fitting them too would
// leave the linked graph a speck in the middle, so the fit ignores them.
const fitView = (ms: number) => {
  if (!fg) return
  const linked = shown.some((n) => n.deg > 0)
  fg.zoomToFit(ms, compact ? 24 : 60, (n: GNode) => !linked || n.deg > 0)
}
const fitSize = () => { if (fg) fg.width(canvasEl.clientWidth).height(canvasEl.clientHeight) }

// Highlight: the focused note, its neighbours and its links; or a hovered
// link and its two ends. Colours change in place; links are re-read.
const light = () => {
  litNodes.clear(); litLinks.clear()
  const f = focusNode()
  if (f) {
    litNodes.add(f)
    for (const m of neighbours.get(f) || []) litNodes.add(m)
    for (const l of linksOf.get(f) || []) litLinks.add(l)
  } else if (hoverLink) {
    litLinks.add(hoverLink)
    for (const n of ends(hoverLink)) if (typeof n === 'object') litNodes.add(n)
  }
  repaint()
  labelLit()
}
const repaint = () => {
  if (!fg) return
  for (const n of shown) {
    const mat = n.__threeObj?.material as THREE.MeshPhongMaterial | undefined
    if (!mat) continue
    mat.color.set(nodeColor(n))
    mat.opacity = litNodes.size && !litNodes.has(n) ? 0.35 : 1
  }
  fg.linkColor(fg.linkColor()).linkWidth(fg.linkWidth()).linkDirectionalParticles(fg.linkDirectionalParticles())
}
const resizeNodes = () => {
  for (const n of shown) {
    const r = nodeRadius(n)
    n.__threeObj?.scale.set(r, r, r)
  }
}
// Name labels float over the lit neighbourhood (the plugin only had a tooltip).
const labelLit = () => {
  for (const o of labelled) o.parent?.remove(o)
  labelled = []
  const f = focusNode()
  if (!S.display.labels || !f) return
  const list = litNodes.size <= LABELS_MAX ? [...litNodes] : [f]
  for (const n of list) {
    const mesh = n.__threeObj
    if (!mesh) continue
    const div = document.createElement('div')
    div.className = 'g3__label' + (n === f ? ' is-focus' : '')
    div.textContent = n.label
    const obj = new CSS2DObject(div)
    // The mesh is scaled by the radius, so 1.4 sits just above the sphere.
    obj.position.set(0, 1.4, 0)
    obj.center.set(0.5, 1)
    mesh.add(obj)
    labelled.push(obj)
  }
}

// -------------------------------------------------------------- the graph
const indexCommunities = () => {
  const size = new Map<string, number>()
  for (const n of data?.nodes || []) if (n.communityName) size.set(n.communityName, (size.get(n.communityName) || 0) + 1)
  communityRank = new Map([...size.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name], i) => [name, i]))
}
const nodeFor = (raw: RawNode): GNode => {
  const key = S.source + '\n' + raw.id
  let n = nodeCache.get(key)
  if (!n) {
    const path = raw.path ?? (isGraphify() ? '' : raw.id)
    const tags = raw.tags || []
    const community = raw.communityName || ''
    const label = raw.title || raw.id
    n = {
      id: raw.id, label, path, tags,
      // A link-graph node IS a note; a Graphify node points at the note it came from.
      note: isGraphify() ? raw.note ?? null : raw.id,
      community, type: (raw.type || '').toLowerCase(),
      labelLower: label.toLowerCase(), pathLower: path.toLowerCase(), tagsLower: tags.map((t) => t.toLowerCase()), communityLower: community.toLowerCase(),
      linkCount: raw.linkCount || 0, deg: 0, color: NODE_GREY, raw,
    }
    nodeCache.set(key, n)
  }
  n.deg = 0
  return n
}

// Build the displayed set from the data, the filters and the local root.
const rebuild = () => {
  if (!data) return
  let source = data.nodes
  if (isGraphify() && S.limit > 0 && source.length > S.limit) source = [...source].sort((a, b) => (b.linkCount || 0) - (a.linkCount || 0)).slice(0, S.limit)
  const byId = new Map<string, GNode>()
  for (const raw of source) byId.set(raw.id, nodeFor(raw))
  // Every [[link]] occurrence arrives; the graph wants each pair once.
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
  const terms = parseQuery(S.search)
  let keep = new Set<GNode>()
  for (const n of byId.values()) if (!terms.length || matchesAll(n, terms)) keep.add(n)
  let kept = pairs.filter(([a, b]) => keep.has(a) && keep.has(b))
  // Local graph: breadth-first from the root, out to the chosen depth.
  const root = localRoot ? byId.get(localRoot) : undefined
  if (localRoot && !root) localRoot = null
  if (root) {
    const adj = new Map<GNode, GNode[]>()
    for (const [a, b] of kept) { (adj.get(a) || adj.set(a, []).get(a)!).push(b); (adj.get(b) || adj.set(b, []).get(b)!).push(a) }
    const reach = new Set<GNode>([root])
    let frontier = [root]
    for (let d = 0; d < S.depth; d++) {
      const next: GNode[] = []
      for (const n of frontier) for (const m of adj.get(n) || []) if (!reach.has(m)) { reach.add(m); next.push(m) }
      frontier = next
    }
    keep = reach
    kept = kept.filter(([a, b]) => keep.has(a) && keep.has(b))
  }
  for (const [a, b] of kept) { a.deg++; b.deg++ }
  if (!S.orphans && !root) keep = new Set([...keep].filter((n) => n.deg > 0))
  shown = [...keep]
  shownLinks = kept.map(([a, b, inferred]) => ({ source: a.id, target: b.id, inferred }))
  compileGroups()
  for (const n of shown) n.color = baseColor(n)
  if (selected && !keep.has(selected)) selected = null
  hoverNode = null; hoverLink = null
  ensureGraph()
  // A new sphere is made for every node on each data change, at its new size.
  fg.graphData({ nodes: shown, links: shownLinks })
  indexLinks(kept)
  light()
  // The engine may make the spheres a moment later; size and colour them then.
  setTimeout(() => { resizeNodes(); light() }, 60)
  renderCard()
  renderTop()
  updateHud()
}
// Indexed from our own pairs: the engine swaps link ends for node objects in
// its own time, but keeps these link objects, so they can be lit by identity.
const indexLinks = (kept: [GNode, GNode, boolean][]) => {
  neighbours.clear(); linksOf.clear()
  kept.forEach(([a, b], i) => {
    const l = shownLinks[i]
    ;(neighbours.get(a) || neighbours.set(a, new Set()).get(a)!).add(b)
    ;(neighbours.get(b) || neighbours.set(b, new Set()).get(b)!).add(a)
    ;(linksOf.get(a) || linksOf.set(a, []).get(a)!).push(l)
    ;(linksOf.get(b) || linksOf.set(b, []).get(b)!).push(l)
  })
}
const recolor = () => {
  compileGroups()
  for (const n of shown) n.color = baseColor(n)
  repaint()
  if (selected) renderCard()
}
const updateHud = () => {
  if (!data) { hudEl.textContent = ''; return }
  const total = data.nodes.length
  const count = shown.length === total ? `${total.toLocaleString()} ${noun()}` : `${shown.length.toLocaleString()} of ${total.toLocaleString()} ${noun()}`
  hudEl.textContent = `${count} · ${shownLinks.length.toLocaleString()} links`
}

// ------------------------------------------------------------- behaviour
const select = (n: GNode | null) => {
  selected = n
  light()
  renderCard()
}
const openNode = (n: GNode) => {
  if (!n.note) return
  // A Graphify node is an idea inside its note: its name finds the passage.
  host.open({ id: n.id, note: n.note, title: n.label, quote: isGraphify() ? n.label : '', path: n.path, raw: n.raw })
}
const showLocal = (n: GNode | null) => {
  localRoot = n ? n.id : null
  rebuild()
  fg.d3ReheatSimulation()
  // Fit whatever is now drawn: the neighbourhood, or the whole graph again.
  setTimeout(() => fitView(1200), 900)
}
const setDepth = (dir: 1 | -1) => {
  const next = Math.max(1, Math.min(DEPTH_MAX, S.depth + dir))
  if (next === S.depth) return
  S.depth = next
  persist()
  if (localRoot) { rebuild(); fg.d3ReheatSimulation() } else renderTop()
}
const setOrbit = (on: boolean) => { S.orbit = on; if (fg) fg.controls().autoRotate = on; persist(); renderDock() }
const stopOrbit = () => { setOrbit(false); if (fg) fitView(900) }
const changeSpeed = (dir: 1 | -1) => {
  const i = SPEED_STEPS.indexOf(S.speed)
  S.speed = SPEED_STEPS[Math.max(0, Math.min(SPEED_STEPS.length - 1, (i < 0 ? 2 : i) + dir))]
  if (fg) fg.controls().autoRotateSpeed = rotateSpeedFor(S.speed)
  persist()
  renderDock()
}

const loadSource = async (source: string) => {
  const src = sourceById(source) || SOURCES[0]
  source = src.id
  S.source = source
  localRoot = null; selected = null
  persist()
  renderTop()
  let g = cache.get(source)
  if (!g) {
    loading = true
    msgEl.hidden = false
    msgEl.textContent = src.loadingText || 'Reading the graph…'
    try {
      g = await host.request<RawGraph>('graph', { source })
      if (!g || !Array.isArray(g.nodes)) throw new Error('no graph data')
      cache.set(source, g)
    } finally { loading = false }
  }
  if (destroyed || S.source !== source) return
  data = g
  msgEl.hidden = !!data.nodes.length
  if (!data.nodes.length) msgEl.textContent = src.emptyText || 'There is nothing to draw yet.'
  indexCommunities()
  renderPanel()
  rebuild()
  // One gentle fit once the layout has bloomed, unless the viewer has taken over.
  viewerMoved = false
  if (firstFitTimer) clearTimeout(firstFitTimer)
  firstFitTimer = setTimeout(() => { if (!viewerMoved) fitView(1500) }, 2500)
  host.notify?.('ready', { nodes: data.nodes.length, links: shownLinks.length })
}

// ---------------------------------------------------------------- render
const renderTop = () => {
  const root = localRoot && data ? shown.find((n) => n.id === localRoot) : null
  topEl.innerHTML = `
    ${SOURCES.length > 1 ? `<div class="g3__seg" role="group" aria-label="Source">${SOURCES.map((src) => `
      <button type="button" class="g3__segb${S.source === src.id ? ' is-active' : ''}" data-source="${escapeHtml(src.id)}"${src.title ? ` title="${escapeHtml(src.title)}"` : ''}${loading ? ' disabled' : ''}>${escapeHtml(src.label)}</button>`).join('')}
    </div>` : ''}
    ${root ? `<div class="g3__local">
      <span class="g3__local-t">Local graph · <b>${escapeHtml(root.label)}</b></span>
      <span class="g3__depth" title="How many links away from the note">
        <button type="button" class="g3__tbtn" data-act="depth-" title="Fewer steps"${S.depth <= 1 ? ' disabled' : ''}>${icons.minus}</button>
        <span>Depth ${S.depth}</span>
        <button type="button" class="g3__tbtn" data-act="depth+" title="More steps"${S.depth >= DEPTH_MAX ? ' disabled' : ''}>${icons.plus}</button>
      </span>
      <button type="button" class="g3__chip" data-act="whole">Whole graph</button>
    </div>` : ''}`
}
const renderDock = () => {
  dockEl.innerHTML = `
    <div class="g3__transport" role="group" aria-label="Orbit">
      <button type="button" class="g3__tbtn${S.orbit ? ' is-active' : ''}" data-act="orbit" title="${S.orbit ? 'Pause' : 'Play'}">${S.orbit ? icons.pause : icons.play}</button>
      <button type="button" class="g3__tbtn" data-act="stop" title="Stop and fit the graph">${icons.stop}</button>
      <button type="button" class="g3__tbtn" data-act="slower" title="Slower"${S.speed <= SPEED_STEPS[0] ? ' disabled' : ''}>${icons.minus}</button>
      <span class="g3__speed" title="One full turn every ${secondsPerTurn()} seconds">${S.speed}×</span>
      <button type="button" class="g3__tbtn" data-act="faster" title="Faster"${S.speed >= SPEED_STEPS[SPEED_STEPS.length - 1] ? ' disabled' : ''}>${icons.plus}</button>
    </div>
    <button type="button" class="g3__round" data-act="fit" title="Fit to view">${icons.fit}</button>`
}
const renderCard = () => {
  const n = selected
  cardEl.hidden = !n
  if (!n) return
  const where = n.path.replace(/^wiki\//, '').replace(/\.md$/, '')
  const sub = isGraphify()
    ? `${n.community || n.type || 'idea'}${where ? ' · ' + where : ''}`
    : `${where.replace(/\/[^/]*$/, '') || 'wiki'} · ${n.deg} links`
  const isRoot = localRoot === n.id
  cardEl.innerHTML = `
    <span class="g3__card-dot" style="background:${escapeHtml(n.color)}"></span>
    <div class="g3__card-t"><div class="g3__card-title">${escapeHtml(n.label)}</div><div class="g3__card-sub">${escapeHtml(sub)}</div></div>
    <button type="button" class="g3__chip" data-act="${isRoot ? 'whole' : 'local'}">${isRoot ? 'Whole graph' : 'Local graph'}</button>
    <button type="button" class="g3__open" data-act="open"${n.note ? '' : ' disabled'}>${n.note ? 'Open note' : 'No note'}</button>`
}

const section = (id: Section, title: string, body: string, tools = '') => `
<section class="g3__sec${S.open[id] ? '' : ' is-closed'}" data-sec="${id}">
  <header class="g3__sec-h">
    <button type="button" class="g3__sec-t" data-toggle="${id}">${S.open[id] ? icons.chevronDown : icons.chevronRight}${title}</button>
    ${tools}
  </header>
  <div class="g3__sec-b">${body}</div>
</section>`
const toggleRow = (label: string, key: string, on: boolean) => `
<label class="g3__row"><span>${label}</span><span class="g3__switch"><input type="checkbox" data-switch="${key}"${on ? ' checked' : ''}><span></span></span></label>`
const sliderRow = (label: string, key: string, value: number, min: number, max: number, step: number) => `
<label class="g3__slider"><span>${label}</span><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`
const limitRow = () => {
  const total = data?.nodes.length || 0
  if (!isGraphify() || total <= LIMIT_OPTIONS[0]) return ''
  const options = LIMIT_OPTIONS.filter((n) => n < total).map((n) => `<option value="${n}"${S.limit === n ? ' selected' : ''}>Top ${n.toLocaleString()}</option>`).join('')
  return `<label class="g3__row"><span>Show</span><select class="g3__select" data-select="limit">${options}<option value="0"${S.limit === 0 || S.limit >= total ? ' selected' : ''}>All ${total.toLocaleString()}</option></select></label>`
}
const groupRows = () => S.groups.map((g, i) => `
<div class="g3__group">
  <input type="text" class="g3__group-q" data-group-q="${i}" value="${escapeHtml(g.query)}" placeholder="path:concepts, tag:name …" spellcheck="false" autocapitalize="off" autocorrect="off">
  <label class="g3__swatch" style="background:${escapeHtml(g.color)}" title="Colour"><input type="color" data-group-c="${i}" value="${escapeHtml(g.color)}"></label>
  <button type="button" class="g3__x" data-group-x="${i}" title="Remove group">${icons.close}</button>
</div>`).join('') + `<button type="button" class="g3__new" data-act="new-group">New group</button>`

const renderPanel = () => {
  const colourBy = isGraphify() ? `
    <div class="g3__row"><span>Colour by</span><span class="g3__seg g3__seg--small">
      <button type="button" class="g3__segb${S.colorBy === 'groups' ? ' is-active' : ''}" data-color="groups">Folder</button>
      <button type="button" class="g3__segb${S.colorBy === 'community' ? ' is-active' : ''}" data-color="community">Community</button>
    </span></div>` : ''
  panelEl.innerHTML =
    section('filters', 'Filters', `
      <label class="g3__search">${icons.search}
        <input type="text" data-bind="search" value="${escapeHtml(S.search)}" placeholder="Search files…" spellcheck="false" autocapitalize="off" autocorrect="off">
      </label>
      <div class="g3__hint">path:folder &nbsp; file:name &nbsp; tag:name &nbsp; ${isGraphify() ? 'community:name &nbsp; type:concept &nbsp; ' : ''}-not</div>
      ${toggleRow('Orphans', 'orphans', S.orphans)}
      ${limitRow()}`,
    `<span class="g3__sec-tools">
        <button type="button" data-act="reset" title="Restore default settings">${icons.reset}</button>
        <button type="button" data-act="close" title="Close">${icons.close}</button>
      </span>`) +
    section('groups', 'Groups', `${colourBy}<div data-groups class="g3__groups">${groupRows()}</div>`) +
    section('display', 'Display',
      sliderRow('Node size', 'display.nodeSize', S.display.nodeSize, 0.2, 4, 0.1) +
      sliderRow('Link thickness', 'display.linkThickness', S.display.linkThickness, 0, 4, 0.1) +
      sliderRow('Link opacity', 'display.linkOpacity', S.display.linkOpacity, 0.05, 1, 0.05) +
      sliderRow('Particle size', 'display.particleSize', S.display.particleSize, 0.5, 6, 0.1) +
      sliderRow('Particle count', 'display.particleCount', S.display.particleCount, 0, 10, 1) +
      toggleRow('Name labels', 'labels', S.display.labels)) +
    section('forces', 'Forces',
      sliderRow('Center force', 'forces.center', S.forces.center, 0, 1, 0.01) +
      sliderRow('Repel force', 'forces.repel', S.forces.repel, 0, 20, 0.1) +
      sliderRow('Link distance', 'forces.linkDistance', S.forces.linkDistance, 10, 200, 1))
}
const renderGroups = () => {
  const el = panelEl.querySelector<HTMLElement>('[data-groups]')
  if (el) el.innerHTML = groupRows()
}

// ---------------------------------------------------------------- events
let rebuildTimer: ReturnType<typeof setTimeout> | null = null
const scheduleRebuild = () => { if (rebuildTimer) clearTimeout(rebuildTimer); rebuildTimer = setTimeout(() => { rebuild(); fg?.d3ReheatSimulation() }, 200) }

app.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-source],[data-color],[data-toggle],[data-group-x]')
  if (!t) return
  if (t.dataset.source) { if (t.dataset.source !== S.source && !loading) void loadSource(t.dataset.source).catch(fail); return }
  if (t.dataset.color) { S.colorBy = t.dataset.color as ColorMode; persist(); recolor(); renderPanel(); return }
  if (t.dataset.toggle) {
    const id = t.dataset.toggle as Section
    S.open[id] = !S.open[id]
    panelEl.querySelector(`[data-sec="${id}"]`)?.classList.toggle('is-closed', !S.open[id])
    t.innerHTML = (S.open[id] ? icons.chevronDown : icons.chevronRight) + escapeHtml(t.textContent || '')
    persist()
    return
  }
  if (t.dataset.groupX != null) { S.groups.splice(Number(t.dataset.groupX), 1); renderGroups(); recolor(); persist(); return }
  switch (t.dataset.act) {
    case 'orbit': setOrbit(!S.orbit); break
    case 'stop': stopOrbit(); break
    case 'slower': changeSpeed(-1); break
    case 'faster': changeSpeed(1); break
    case 'fit': fitView(900); break
    case 'open': if (selected) openNode(selected); break
    case 'local': if (selected) showLocal(selected); break
    case 'whole': showLocal(null); break
    case 'depth-': setDepth(-1); break
    case 'depth+': setDepth(1); break
    case 'close': showPanel(false); break
    case 'reset': {
      const source = S.source
      Object.assign(S, defaults(), { open: S.open, source })
      renderPanel(); renderDock(); applyForces(); recolor()
      if (fg) { fg.linkOpacity(S.display.linkOpacity).linkDirectionalParticleWidth(S.display.particleSize); fg.controls().autoRotate = S.orbit; fg.controls().autoRotateSpeed = rotateSpeedFor(S.speed) }
      rebuild(); fg?.d3ReheatSimulation(); persist()
      break
    }
    case 'new-group':
      S.groups.push({ query: '', color: NEW_GROUP_COLORS[S.groups.length % NEW_GROUP_COLORS.length] })
      renderGroups(); persist()
      panelEl.querySelector<HTMLInputElement>(`[data-group-q="${S.groups.length - 1}"]`)?.focus()
      break
  }
})
gearEl.addEventListener('click', () => showPanel(true))
panelEl.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement
  if (t.dataset.bind === 'search') { S.search = t.value; scheduleRebuild(); persist(); return }
  if (t.dataset.groupQ != null) { S.groups[Number(t.dataset.groupQ)].query = t.value; recolor(); persist(); return }
  if (t.dataset.groupC != null) {
    S.groups[Number(t.dataset.groupC)].color = t.value
    ;(t.parentElement as HTMLElement).style.background = t.value
    recolor(); persist(); return
  }
  if (!t.dataset.range) return
  const [a, b] = t.dataset.range.split('.') as ['display' | 'forces', string]
  ;(S[a] as any)[b] = Number(t.value)
  if (a === 'forces') { applyForces(); fg?.d3ReheatSimulation() }
  else if (b === 'nodeSize') resizeNodes()
  else if (b === 'linkOpacity') fg?.linkOpacity(S.display.linkOpacity)
  else if (b === 'particleSize') fg?.linkDirectionalParticleWidth(S.display.particleSize)
  else repaint()
  persist()
})
panelEl.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement
  if (t.dataset.select === 'limit') { S.limit = Number(t.value) || 0; persist(); scheduleRebuild(); return }
  if (t.dataset.switch === 'orphans') { S.orphans = t.checked; scheduleRebuild() }
  else if (t.dataset.switch === 'labels') { S.display.labels = t.checked; labelLit() }
  persist()
})

// ------------------------------------------------------------------ boot
const fail = (err: unknown) => {
  msgEl.hidden = false
  msgEl.textContent = 'Could not load the graph.'
  renderTop()
  host.notify?.('failed', { message: err instanceof Error ? err.message : 'unknown' })
}
const start = async () => {
  renderPanel()
  showPanel(panelOpen)
  renderDock()
  renderTop()
  // The host may hand over the first source's graph up front; anything else is asked for.
  if (opts.initialData) cache.set(SOURCES[0].id, opts.initialData as RawGraph)
  try { await loadSource(S.source) } catch (err) { fail(err) }
}

// Debugging handle for the Web Inspector.
;(host.debug ? (window as any) : {}).__kg3d = { fg: () => fg, shown: () => shown, links: () => shownLinks, settings: () => S, lit: () => ({ nodes: litNodes.size, links: litLinks.size }), select: (id: string) => select(shown.find((n) => n.id === id) || null), local: (id: string | null) => showLocal(id ? shown.find((n) => n.id === id) || null : null), hover: (id: string | null) => { hoverNode = id ? shown.find((n) => n.id === id) || null : null; light() }, labels: () => labelled.length }

const destroy = () => {
  if (destroyed) return
  destroyed = true
  if (firstFitTimer) clearTimeout(firstFitTimer)
  if (rebuildTimer) clearTimeout(rebuildTimer)
  resizeObserver?.disconnect()
  if (fg) { fg.pauseAnimation?.(); fg._destructor?.(); fg = null }
  app.innerHTML = ''
  if ((window as any).__kg3d?.page === page) delete (window as any).__kg3d
}
const page: GraphPage = { destroy }
if (host.debug) (window as any).__kg3d.page = page
start()
return page
}
