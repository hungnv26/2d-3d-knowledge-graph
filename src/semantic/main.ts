// 3D Semantic Graph: every note placed by meaning (embeddings projected to 3D
// with UMAP by tools/semantic), rendered with 3d-force-graph.
// Modelled on the open-source Obsidian "3D Semantic Graph" plugin (MIT).
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { escapeHtml, icons, injectStyle, type GraphHost, type GraphPage, type Group, type SemanticCategory } from '../host'
// @ts-expect-error bundled as text by esbuild
import css from './semantic.css'

/** `cluster`, or the id of one of the host's categories. */
type ColorMode = string
interface SNode {
  id: string; label: string; tags: string[]; x: number; y: number; z: number; cluster: number; degree: number
  /** Where the note lives, for path: searches; defaults to the id. */
  path?: string
  /** Category fields (folder, kind, status, year …), read through the host's categories. */
  [field: string]: unknown
}
interface Cluster { id: number; size: number; label: string; center_id: string }
interface Graph { ready: boolean; built_at?: string; nodes: SNode[]; clusters: Cluster[]; links: { source: string; target: string }[] }
interface Status {
  ready: boolean; building: boolean; build_line: string | null; build_failed: string | null
  stale?: boolean; built_at?: string; n_notes?: number; n_clusters?: number; n_links?: number; message?: string
}
interface Hit { id: string; label: string; score: number }
type Section = 'filters' | 'groups' | 'display'
// The same settings panel as the 3D Knowledge Graph, less Forces: positions here
// come from meaning, not from a simulation, so Spread takes their place.
interface Display {
  nodeSize: number; linkThickness: number; linkOpacity: number
  particleSize: number; particleCount: number; labels: boolean
  /** Multiplies every position: pulls the cloud together or spreads it apart. */
  spread: number
  regionOpacity: number
}
interface Settings {
  colorBy: ColorMode; links: boolean; hulls: boolean; orbit: boolean; speed: number; legend: boolean
  groups: Group[]; display: Display; panel: boolean; open: Record<Section, boolean>
  /** The Filters search, kept between visits like every other setting. */
  filter: string
  /** Which part of the notes is drawn, when the host offers scopes. */
  scope: string
}
interface Term { field: string; value: string; neg: boolean }

export interface SemanticOptions {
  /** Where this page's settings are kept. */
  settingsKey: string
  /** Ways to colour the notes besides their clusters; the first is shown in the side card. */
  categories: SemanticCategory[]
  /** Parts of the notes to draw, if the host offers a choice; sent as `scope`. */
  scopes?: { id: string; label: string }[]
  /** The scope a first visit opens on; defaults to the first. */
  defaultScope?: string
  /** Whether this host may rebuild the layout. */
  allowBuild: boolean
  /** Shown when the layout has not been built: to someone who can build it, and to someone who cannot. */
  buildIntro: string
  buildHint: string
  /** Status and graph the host already has. */
  initialStatus?: unknown
  initialData?: unknown
}
const PALETTE = ['#e0498a', '#f28c28', '#3dbb5b', '#3f7fe0', '#8b5cf6', '#22b8cf', '#e5484d', '#14b8a6', '#d97706', '#6366f1',
  '#ec4899', '#84cc16', '#0ea5e9', '#a855f7', '#f43f5e', '#10b981', '#eab308', '#2563eb', '#c026d3', '#fb7185', '#4ade80', '#38bdf8', '#f97316', '#a3e635']
const SPEED_STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16]
const DIM = '#2a2f3a'
const ENTRY_MS = 4200

export function mountSemantic(root: HTMLElement, host: GraphHost, opts: SemanticOptions): GraphPage {
const SETTINGS_KEY = opts.settingsKey
const CATEGORIES = opts.categories
const SCOPES = opts.scopes || []
const catById = (id: string) => CATEGORIES.find((c) => c.id === id)
let destroyed = false
const compact = host.compact
const ACCENT = host.accent || '#8b7cf6'   // lit links and their particles

const NEW_GROUP_COLORS = ['#e05252', '#e0b152', '#b1e052', '#52e052', '#52e0b1', '#52b1e0', '#5a5ae2', '#b152e0', '#e052b1', '#f28c3a']
const LABELS_MAX = compact ? 16 : 40   // a note with more neighbours than this labels only itself
const defaults = (): Settings => ({
  colorBy: 'cluster', links: true, hulls: true, orbit: true, speed: 1, legend: !compact, scope: (SCOPES.some((x) => x.id === opts.defaultScope) ? opts.defaultScope : SCOPES[0]?.id) || '',
  groups: [],
  display: { nodeSize: 1, linkThickness: 0, linkOpacity: 0.18, particleSize: 1.5, particleCount: 3, labels: true, spread: 1, regionOpacity: 0.07 },
  panel: false,
  open: { filters: true, groups: true, display: true },
  filter: '',
})
const loadSettings = (): Settings => {
  const d = defaults()
  try {
    const raw = host.loadSetting(SETTINGS_KEY)
    if (!raw) return d
    const s = JSON.parse(raw)
    return {
      colorBy: catById(s.colorBy) ? s.colorBy : 'cluster',
      scope: SCOPES.some((x) => x.id === s.scope) ? s.scope : d.scope,
      links: s.links !== false, hulls: s.hulls !== false, orbit: s.orbit !== false,
      speed: SPEED_STEPS.includes(s.speed) ? s.speed : 1,
      legend: compact ? false : s.legend !== false,
      groups: Array.isArray(s.groups) ? s.groups.filter((g: any) => g && typeof g.query === 'string' && typeof g.color === 'string') : d.groups,
      display: { ...d.display, ...(s.display || {}) },
      panel: compact ? false : s.panel === true,
      open: { ...d.open, ...(s.open || {}) },
      filter: typeof s.filter === 'string' ? s.filter : '',
    }
  } catch { return d }
}
const S = loadSettings()
const persist = () => host.saveSetting(SETTINGS_KEY, S)

// ------------------------------------------------------------ query language
// The Knowledge Graphs' language: terms are ANDed; path:, file:, tag:,
// cluster: and one field per category (folder:, kind: …); -term negates;
// "quoted phrases" keep spaces.
const FIELDS = ['path', 'file', 'tag', 'cluster', ...CATEGORIES.map((c) => c.id)]
const parseQuery = (q: string): Term[] => {
  const terms: Term[] = []
  const re = new RegExp(`(-)?(?:(${FIELDS.join('|')}):)?(?:"([^"]*)"|(\\S+))`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(q))) {
    const value = (m[3] ?? m[4] ?? '').toLowerCase()
    if (value) terms.push({ neg: !!m[1], field: m[2] || 'any', value })
  }
  return terms
}
const matchTerm = (n: SNode, t: Term) => {
  const v = t.value.replace(/^#/, '')
  const path = (n.path || n.id).toLowerCase()
  const label = n.label.toLowerCase()
  const tags = n.tags.map((x) => x.toLowerCase())
  const cluster = clusterLabel(n.cluster).toLowerCase()
  let hit: boolean
  switch (t.field) {
    case 'path': hit = path.includes(t.value); break
    case 'file': hit = label.includes(t.value); break
    case 'tag': hit = tags.some((x) => x === v || x.startsWith(v + '/')); break
    case 'cluster': hit = cluster.includes(t.value); break
    case 'any': hit = label.includes(t.value) || path.includes(t.value) || tags.some((x) => x.includes(v)) || cluster.includes(t.value); break
    default: {
      const cat = catById(t.field)
      hit = !!cat && (catValue(n, cat).toLowerCase().includes(t.value) || catLabel(cat, catValue(n, cat)).toLowerCase().includes(t.value))
    }
  }
  return t.neg ? !hit : hit
}
const matchesAll = (n: SNode, terms: Term[]) => terms.every((t) => matchTerm(n, t))

// ------------------------------------------------------------------- DOM
injectStyle('graph-semantic-css', css)
const app = root
app.innerHTML = `
<div class="sg${compact ? ' is-compact' : ''}">
  <div class="sg__canvas"></div>
  <div class="sg__msg">Loading the semantic graph…</div>
  <div class="sg__hud"></div>
  <div class="sg__toolbar"></div>
  <aside class="sg__legend" hidden></aside>
  <aside class="sg__side" hidden></aside>
  <aside class="sg__panel" hidden></aside>
</div>`
const $ = <T extends HTMLElement>(sel: string, root: ParentNode = app) => root.querySelector(sel) as T
const canvasEl = $('.sg__canvas')
const msgEl = $('.sg__msg')
const hudEl = $('.sg__hud')
const toolbarEl = $('.sg__toolbar')
const legendEl = $('.sg__legend')
const sideEl = $('.sg__side')
const panelEl = $('.sg__panel')

// ----------------------------------------------------------------- state
let status: Status | null = (opts.initialStatus as Status) || null
let initialData = opts.initialData as Graph | undefined
let graph: Graph | null = null
let fg: any = null
let canvasObserver: ResizeObserver | null = null
let hulls: THREE.Mesh[] = []
let selected: SNode | null = null
let neighbors: Hit[] = []
let hits: Hit[] = []
let highlighted = new Set<string>()
let focusCluster: number | null = null
/** In a category mode, the value the legend is focused on. */
let focusValue: string | null = null
let searchError = ''
let query = ''
let building = false
let pollTimer: ReturnType<typeof setTimeout> | null = null
let entryFrame = 0
let entryTimer: ReturnType<typeof setTimeout> | null = null
const nodeById = new Map<string, SNode>()
/** The engine's own node and link objects, all of them; a filter shows a subset. */
let allNodes: any[] = []
let allLinks: any[] = []
const drawnById = new Map<string, any>()
let filterText = S.filter
let hoverNode: SNode | null = null
const litNodes = new Set<string>()
const litLinks = new Set<any>()
let labelled: CSS2DObject[] = []
// Only a mouse or trackpad hovers. A finger also sends hover events on its way
// to a tap, which would light a different note from the one it selects.
let pointerKind = host.platform === 'ios' ? 'touch' : 'mouse'
const hovering = () => pointerKind === 'mouse' || pointerKind === 'pen'
let compiledGroups: { terms: Term[]; color: string }[] = []
const compileGroups = () => { compiledGroups = S.groups.map((g) => ({ terms: parseQuery(g.query), color: g.color })) }
compileGroups()

const clusterColor = (id: number) => PALETTE[((id % PALETTE.length) + PALETTE.length) % PALETTE.length]
// A category's colours: the host's fixed ones, else the palette by how common the value is.
const catValue = (n: SNode, cat: SemanticCategory) => { const v = n[cat.field]; return v == null ? '' : String(v) }
const catLabel = (cat: SemanticCategory, v: string) => cat.labels?.[v] || v || 'None'
let catRank = new Map<string, Map<string, number>>()
const indexCategories = () => {
  catRank = new Map()
  for (const cat of CATEGORIES) {
    const counts = new Map<string, number>()
    for (const n of graph?.nodes || []) { const v = catValue(n, cat); counts.set(v, (counts.get(v) || 0) + 1) }
    catRank.set(cat.id, new Map([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v], i) => [v, i])))
  }
}
const catColor = (cat: SemanticCategory, v: string) => {
  const ruled = cat.colorOf?.(v)
  if (ruled) return ruled
  if (cat.colors?.[v]) return cat.colors[v]
  if (!v) return '#6b7280'
  const r = catRank.get(cat.id)?.get(v) ?? 0
  return PALETTE[r % PALETTE.length]
}
const clusterLabel = (id: number) => graph?.clusters.find((c) => c.id === id)?.label || String(id)
// Groups from the settings panel win over the cluster or folder colour.
const baseColor = (n: SNode) => {
  for (const g of compiledGroups) if (g.terms.length && matchesAll(n, g.terms)) return g.color
  const cat = catById(S.colorBy)
  return cat ? catColor(cat, catValue(n, cat)) : clusterColor(n.cluster)
}
const focusNode = () => hoverNode || selected
const nodeColor = (n: SNode) => {
  const f = focusNode()
  if (f?.id === n.id) return '#ffffff'
  if (litNodes.size) return litNodes.has(n.id) ? baseColor(n) : DIM
  const dim = (S.colorBy === 'cluster' && focusCluster !== null && n.cluster !== focusCluster)
    || (S.colorBy !== 'cluster' && focusValue !== null && catById(S.colorBy) != null && catValue(n, catById(S.colorBy)!) !== focusValue)
    || (highlighted.size > 0 && !highlighted.has(n.id))
  return dim ? DIM : baseColor(n)
}
const rotateSpeedFor = (s: number) => s / 2   // 1× is one turn every two minutes
const secondsPerTurn = () => Math.round((120 / S.speed) * 10) / 10

// ---------------------------------------------------------------- engine
const NODE_REL_SIZE = 1.6
const nodeRadius = (n: SNode) => NODE_REL_SIZE * Math.cbrt(1 + Math.min(5, Math.sqrt(n.degree || 0))) * S.display.nodeSize
// Fewer segments on a phone: a thousand spheres are a lot of triangles there.
const sphereGeom = new THREE.SphereGeometry(1, compact ? 16 : 32, compact ? 12 : 24)
const nodeSphere = (n: SNode) => {
  const mat = new THREE.MeshPhongMaterial({ color: nodeColor(n), shininess: 80, specular: new THREE.Color(0x666666), transparent: true, opacity: 1 })
  const mesh = new THREE.Mesh(sphereGeom, mat)
  const r = nodeRadius(n)
  mesh.scale.set(r, r, r)
  return mesh
}
const homeCamera = () => {
  const aspect = (canvasEl.clientWidth || 1) / (canvasEl.clientHeight || 1)
  // A portrait screen needs the camera further back, but not by the full
  // aspect ratio: the cloud is roughly as tall as it is wide.
  return { x: 0, y: 60, z: aspect >= 1 ? 340 : Math.min(700, 340 / Math.pow(aspect, 0.75)) }
}

const ensureGraph = () => {
  if (fg) return
  // Orbit controls: the default trackball controls have no auto-rotate.
  const labels = new CSS2DRenderer()
  labels.domElement.style.pointerEvents = 'none'
  fg = new (ForceGraph3D as any)(canvasEl, { controlType: 'orbit', extraRenderers: [labels] })
    .backgroundColor('#0e1014')
    .showNavInfo(false)
    .enableNodeDrag(false)
    // Positions are pinned (fx/fy/fz), so the engine only copies them; it runs
    // briefly after each data change so the entry animation reaches the links.
    .cooldownTime(2500)
    .warmupTicks(0)
    .nodeId('id')
    .nodeLabel((n: any) => hovering() ? `<div class="sg__tip">${escapeHtml(n.label)}</div>` : '')
    .nodeThreeObject((n: any) => nodeSphere(n))
    .linkOpacity(S.display.linkOpacity)
    .linkColor((l: any) => litLinks.has(l) ? ACCENT : litNodes.size ? 'rgba(120,128,150,0.25)' : '#8892b0')
    .linkWidth((l: any) => litLinks.has(l) ? Math.max(1.2, S.display.linkThickness * 1.5) : S.display.linkThickness)
    .linkDirectionalParticles((l: any) => litLinks.has(l) ? S.display.particleCount : 0)
    .linkDirectionalParticleWidth(S.display.particleSize)
    .linkDirectionalParticleSpeed(0.006)
    .linkDirectionalParticleColor(() => ACCENT)
    // Hovering lights a note and the notes closest to it in meaning.
    .onNodeHover((n: any) => {
      const next = hovering() && n ? (nodeById.get(n.id) || null) : null
      if (next === hoverNode) return
      hoverNode = next
      canvasEl.style.cursor = next ? 'pointer' : ''
      light()
    })
    // With a pointer, a click goes straight to the note (it opens beside the
    // graph on the Mac). A tap selects first; the card carries Open note.
    .onNodeClick((n: any) => {
      void selectNode(n as SNode, true)
      if (hovering()) openNote(nodeById.get(n.id) || n)
    })
    .onBackgroundClick(() => { selected = null; neighbors = []; light(); renderSide() })
  for (const type of ['pointerdown', 'pointermove'] as const) {
    canvasEl.addEventListener(type, (e) => { pointerKind = e.pointerType || 'mouse' }, { capture: true, passive: true })
  }
  // Softer ambient light plus key and fill lights give the spheres shading.
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(1, 1.4, 1.2)
  const fill = new THREE.DirectionalLight(0xdfe7ff, 0.9)
  fill.position.set(-1.4, -0.6, -1)
  fg.lights([new THREE.AmbientLight(0xffffff, 1.1), key, fill, new THREE.HemisphereLight(0xffffff, 0x333344, 0.5)])
  const controls = fg.controls()
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.autoRotate = S.orbit
  controls.autoRotateSpeed = rotateSpeedFor(S.speed)
  canvasObserver = new ResizeObserver(() => fitSize())
  canvasObserver.observe(canvasEl)
  fitSize()
  // Inspection handles for tests and devtools, only when the host asks for them.
  if (host.debug) (window as any).__kgSemanticGraph = fg
  ;(host.debug ? (window as any) : {}).__kgSemantic = { settings: () => S, lit: () => ({ nodes: litNodes.size, links: litLinks.size }), labels: () => labelled.length, hover: (id: string | null) => { hoverNode = id ? nodeById.get(id) || null : null; light() }, filter: (q: string) => { filterText = q; applyFilter() }, shown: () => fg.graphData().nodes.length }
}
const fitSize = () => { if (fg) fg.width(canvasEl.clientWidth).height(canvasEl.clientHeight) }
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Entry animation: notes start at the centre and expand to their semantic
// positions while the camera flies in. The engine overwrites each node's x/y/z
// with its pinned fx/fy/fz on every tick, so the targets live in tx/ty/tz.
// Positions stay pinned: there is no force simulation afterwards.
const animateEntry = (nodes: any[], onDone: () => void) => {
  cancelAnimationFrame(entryFrame)
  if (entryTimer) clearTimeout(entryTimer)
  const started = performance.now()
  const ease = (t: number) => 1 - Math.pow(1 - t, 4)
  let finished = false
  const place = (f: number) => {
    for (const n of nodes) {
      n.fx = n.tx * f; n.fy = n.ty * f; n.fz = n.tz * f
      n.x = n.fx; n.y = n.fy; n.z = n.fz
      if (n.__threeObj) n.__threeObj.position.set(n.fx, n.fy, n.fz)
    }
  }
  const finish = () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(entryFrame)
    place(1)
    onDone()
  }
  const step = (now: number) => {
    if (finished) return
    const t = Math.min(1, (now - started) / ENTRY_MS)
    place(ease(t))
    if (t < 1) entryFrame = requestAnimationFrame(step)
    else finish()
  }
  entryFrame = requestAnimationFrame(step)
  // A hidden view pauses animation frames; make sure the final state lands anyway.
  entryTimer = setTimeout(finish, ENTRY_MS + 600)
}

const render = () => {
  if (!fg || !graph) return
  const animate = !reducedMotion()
  const k = S.display.spread
  allNodes = graph.nodes.map((n) => ({ ...n, x0: n.x, y0: n.y, z0: n.z, tx: n.x * k, ty: n.y * k, tz: n.z * k, fx: animate ? 0 : n.x * k, fy: animate ? 0 : n.y * k, fz: animate ? 0 : n.z * k }))
  allLinks = graph.links.map((l) => ({ ...l }))
  drawnById.clear()
  for (const n of allNodes) drawnById.set(n.id, n)
  const home = homeCamera()
  if (!animate) {
    applyFilter()
    drawHulls()
    fg.cameraPosition(home, { x: 0, y: 0, z: 0 }, 800)
    return
  }
  // Links join once the notes have reached their places.
  applyFilter(false)
  fg.cameraPosition({ x: 0, y: 220, z: home.z * 2.6 }, { x: 0, y: 0, z: 0 }, 0)
  setTimeout(() => fg && fg.cameraPosition(home, { x: 0, y: 0, z: 0 }, ENTRY_MS), 60)
  animateEntry(allNodes, () => {
    if (!fg) return
    applyFilter()
    drawHulls()
  })
}
// The Filters search hides the notes that do not match, with their links.
const applyFilter = (withLinks = true) => {
  if (!fg) return
  const terms = parseQuery(filterText)
  const nodes = terms.length ? allNodes.filter((n) => matchesAll(n as SNode, terms)) : allNodes
  const keep = new Set(nodes.map((n) => n.id))
  const idOf = (end: any) => (typeof end === 'object' ? end.id : end)
  const matching = S.links ? allLinks.filter((l) => keep.has(idOf(l.source)) && keep.has(idOf(l.target))) : []
  // During the entry animation the links wait until the notes are in place.
  const links = withLinks ? matching : []
  fg.graphData({ nodes, links })
  if (hoverNode && !keep.has(hoverNode.id)) hoverNode = null
  light()
  setTimeout(() => { resizeNodes(); light() }, 60)
  hudEl.textContent = hudText(nodes.length, matching.length)
}
const hudText = (nodes: number, links: number) => {
  if (!graph) return ''
  const total = graph.nodes.length
  const count = nodes === total ? `${total.toLocaleString()} notes` : `${nodes.toLocaleString()} of ${total.toLocaleString()} notes`
  return `${count} · ${links.toLocaleString()} links · ${graph.clusters.length} cluster${graph.clusters.length === 1 ? '' : 's'}`
}
// Spread scales the layout about its middle; the notes glide there.
const applySpread = () => {
  const k = S.display.spread
  for (const n of allNodes) {
    n.tx = n.x0 * k; n.ty = n.y0 * k; n.tz = n.z0 * k
    n.fx = n.tx; n.fy = n.ty; n.fz = n.tz
  }
  fg?.d3ReheatSimulation()
  drawHulls()
}
const resizeNodes = () => {
  for (const n of allNodes) {
    const r = nodeRadius(n as SNode)
    n.__threeObj?.scale.set(r, r, r)
  }
}
// The focused note, the notes linked to it by meaning, and those links.
const light = () => {
  litNodes.clear(); litLinks.clear()
  const f = focusNode()
  if (f && fg) {
    litNodes.add(f.id)
    for (const l of fg.graphData().links as any[]) {
      const a = typeof l.source === 'object' ? l.source.id : l.source
      const b = typeof l.target === 'object' ? l.target.id : l.target
      if (a === f.id || b === f.id) { litLinks.add(l); litNodes.add(a); litNodes.add(b) }
    }
  }
  repaint()
  if (fg) fg.linkColor(fg.linkColor()).linkWidth(fg.linkWidth()).linkDirectionalParticles(fg.linkDirectionalParticles())
  labelLit()
}
const labelLit = () => {
  for (const o of labelled) o.parent?.remove(o)
  labelled = []
  const f = focusNode()
  if (!S.display.labels || !f) return
  const ids = litNodes.size <= LABELS_MAX ? [...litNodes] : [f.id]
  for (const id of ids) {
    const mesh = drawnById.get(id)?.__threeObj
    if (!mesh) continue
    const div = document.createElement('div')
    div.className = 'sg__nlabel' + (id === f.id ? ' is-focus' : '')
    div.textContent = nodeById.get(id)?.label || id
    const obj = new CSS2DObject(div)
    obj.position.set(0, 1.4, 0)
    obj.center.set(0.5, 1)
    mesh.add(obj)
    labelled.push(obj)
  }
}
// Custom node objects keep their own material, so recolour them in place.
const repaint = () => {
  if (!fg) return
  for (const n of fg.graphData().nodes as any[]) {
    const mat = n.__threeObj?.material
    if (!mat?.color) continue
    mat.color.set(nodeColor(n as SNode))
    mat.opacity = litNodes.size && !litNodes.has(n.id) ? 0.35 : 1
  }
}
const drawHulls = () => {
  if (!fg) return
  const scene = fg.scene()
  for (const h of hulls) { scene.remove(h); h.geometry.dispose(); (h.material as THREE.Material).dispose() }
  hulls = []
  if (!S.hulls || !graph || S.colorBy !== 'cluster') return
  const byCluster = new Map<number, THREE.Vector3[]>()
  for (const n of graph.nodes) {
    if (!byCluster.has(n.cluster)) byCluster.set(n.cluster, [])
    const k = S.display.spread
    byCluster.get(n.cluster)!.push(new THREE.Vector3(n.x * k, n.y * k, n.z * k))
  }
  for (const [id, pts] of byCluster) {
    if (pts.length < 4) continue
    try {
      const mat = new THREE.MeshBasicMaterial({ color: clusterColor(id), transparent: true, opacity: S.display.regionOpacity, side: THREE.DoubleSide, depthWrite: false })
      const mesh = new THREE.Mesh(new ConvexGeometry(pts), mat)
      scene.add(mesh)
      hulls.push(mesh)
    } catch { /* degenerate (coplanar) cluster */ }
  }
}
const flyTo = (n: SNode) => {
  if (!fg) return
  const k = S.display.spread
  const x = n.x * k, y = n.y * k, z = n.z * k
  const d = Math.hypot(x, y, z) || 1
  const ratio = 1 + 120 / d
  fg.cameraPosition({ x: x * ratio, y: y * ratio, z: z * ratio }, { x, y, z }, 900)
}

// ------------------------------------------------------------- behaviour
const selectNode = async (n: SNode, fly: boolean) => {
  selected = nodeById.get(n.id) || n
  neighbors = []
  light()
  renderSide()
  if (fly) flyTo(selected)
  try {
    const res = await host.request<{ results: Hit[] }>('semanticNeighbors', { id: selected.id, limit: 8, scope: S.scope })
    if (selected?.id === n.id) { neighbors = res?.results || []; renderSide() }
  } catch { /* neighbours are optional */ }
}
const selectById = (id: string, fly: boolean) => { const n = nodeById.get(id); if (n) void selectNode(n, fly) }

const search = async () => {
  const text = query.trim()
  if (text.length < 2) return
  searchError = ''
  try {
    const res = await host.request<{ results: Hit[]; error?: string }>('semanticSearch', { query: text, limit: 12, scope: S.scope })
    hits = res?.results || []
    highlighted = new Set(hits.map((r) => r.id))
    searchError = res?.error || (hits.length ? '' : 'No notes are close to that.')
    repaint()
    renderSide()
    if (hits[0]) selectById(hits[0].id, true)
  } catch (err) {
    hits = []
    highlighted = new Set()
    searchError = err instanceof Error ? err.message : 'Search failed'
    repaint()
    renderSide()
  }
}
const clearSearch = () => {
  query = ''
  hits = []
  highlighted = new Set()
  searchError = ''
  const input = toolbarEl.querySelector<HTMLInputElement>('[data-bind="q"]')
  if (input) input.value = ''
  repaint()
  renderSide()
}

const setOrbit = (on: boolean) => { S.orbit = on; if (fg) fg.controls().autoRotate = on; persist(); renderToolbar() }
const stopOrbit = () => {
  setOrbit(false)
  if (fg) fg.cameraPosition(homeCamera(), { x: 0, y: 0, z: 0 }, 800)
}
const changeSpeed = (dir: 1 | -1) => {
  const i = SPEED_STEPS.indexOf(S.speed)
  S.speed = SPEED_STEPS[Math.max(0, Math.min(SPEED_STEPS.length - 1, (i < 0 ? 2 : i) + dir))]
  if (fg) fg.controls().autoRotateSpeed = rotateSpeedFor(S.speed)
  persist()
  renderToolbar()
}

const startBuild = async () => {
  if (building) return
  building = true
  renderToolbar()
  renderMessage()
  try {
    const res = await host.request<{ started?: boolean; building?: boolean; error?: string }>('semanticBuild')
    if (res?.error) { building = false; status = { ...(status || { ready: false, building: false, build_line: null }), build_failed: res.error } as Status }
  } catch (err) {
    building = false
    status = { ...(status || { ready: false, building: false, build_line: null }), build_failed: err instanceof Error ? err.message : 'Could not start the build' } as Status
  }
  renderToolbar()
  renderMessage()
  if (building) pollBuild()
}
const pollBuild = () => {
  if (pollTimer) clearTimeout(pollTimer)
  const tick = async () => {
    try {
      const s = await host.request<Status>('semanticStatus')
      status = s
      if (!s.building) {
        building = false
        if (s.ready && !s.build_failed) await loadGraph()
        renderToolbar()
        renderMessage()
        return
      }
      building = true
      renderToolbar()
      renderMessage()
    } catch { /* keep polling */ }
    pollTimer = setTimeout(tick, 2500)
  }
  pollTimer = setTimeout(tick, 1500)
}

// ---------------------------------------------------------------- render
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '')
const chip = (label: string, attrs: string, active = false, extra = '') =>
  `<button type="button" class="sg__chip${active ? ' is-active' : ''}${extra}" ${attrs}>${label}</button>`

const renderToolbar = () => {
  const ready = !!graph
  const buildLabel = building
    ? `Building… ${escapeHtml((status?.build_line || '').slice(0, 40))}`
    : status?.ready ? 'Rebuild' : 'Build'
  toolbarEl.innerHTML = `
    ${compact ? chip(`${icons.gear} Settings`, 'data-act="panel"', S.panel) : ''}
    ${compact ? chip(`${icons.layers} Legend`, 'data-act="legend"', S.legend) : ''}
    ${SCOPES.length ? `<span class="sg__label">Show</span>${SCOPES.map((x) => chip(escapeHtml(x.label), `data-scope="${escapeHtml(x.id)}"`, S.scope === x.id)).join('')}<span class="sg__sep"></span>` : ''}
    <span class="sg__label">Colour by</span>
    ${chip('Cluster', 'data-color="cluster"', S.colorBy === 'cluster')}
    ${CATEGORIES.map((c) => chip(escapeHtml(c.label), `data-color="${escapeHtml(c.id)}"`, S.colorBy === c.id)).join('')}
    <span class="sg__sep"></span>
    ${chip('Links', 'data-act="links"', S.links)}
    ${chip('Cluster regions', 'data-act="hulls"', S.hulls)}
    <span class="sg__sep"></span>
    <span class="sg__label">Orbit</span>
    <div class="sg__transport" role="group" aria-label="Orbit">
      <button type="button" class="sg__tbtn${S.orbit ? ' is-active' : ''}" data-act="orbit" title="${S.orbit ? 'Pause' : 'Play'}">${S.orbit ? icons.pause : icons.play}</button>
      <button type="button" class="sg__tbtn" data-act="stop" title="Stop and return to the start">${icons.stop}</button>
      <button type="button" class="sg__tbtn" data-act="slower" title="Slower"${S.speed <= SPEED_STEPS[0] ? ' disabled' : ''}>${icons.minus}</button>
      <span class="sg__speed" title="One full turn every ${secondsPerTurn()} seconds">${S.speed}×</span>
      <button type="button" class="sg__tbtn" data-act="faster" title="Faster"${S.speed >= SPEED_STEPS[SPEED_STEPS.length - 1] ? ' disabled' : ''}>${icons.plus}</button>
    </div>
    ${compact ? '' : chip(`${icons.gear} Settings`, 'data-act="panel"', S.panel)}
    <span class="sg__spacer"></span>
    ${status?.ready ? `<span class="sg__stamp">Built ${escapeHtml(fmt(status.built_at))}${status.stale ? ' <span class="sg__stale">· notes changed since</span>' : ''}</span>` : ''}
    ${opts.allowBuild ? chip(buildLabel, `data-act="build"${building ? ' disabled' : ''}`, false) : ''}
    <label class="sg__search">${icons.search}
      <input type="search" data-bind="q" value="${escapeHtml(query)}" placeholder="Search by meaning, then Return" autocapitalize="off" autocorrect="off" spellcheck="false"${ready ? '' : ' disabled'}>
      ${query ? `<button type="button" data-act="clear" title="Clear">${icons.close}</button>` : ''}
    </label>`
  positionPanels()
}

const positionPanels = () => {
  const top = toolbarEl.offsetTop + toolbarEl.offsetHeight + 8
  legendEl.style.top = `${top}px`
  sideEl.style.top = `${top}px`
  panelEl.style.top = `${top}px`
  // The settings panel takes the right edge; the side card moves over for it.
  sideEl.classList.toggle('is-beside', S.panel && !compact)
  if (compact) sideEl.style.visibility = S.panel ? 'hidden' : ''
}

const renderLegend = () => {
  if (!graph || !S.legend) { legendEl.hidden = true; return }
  legendEl.hidden = false
  if (S.colorBy === 'cluster') {
    legendEl.innerHTML = `<div class="sg__title">Clusters</div>` + graph.clusters.map((c) => `
      <div class="sg__lrow${focusCluster === c.id ? ' is-focus' : ''}${focusCluster !== null && focusCluster !== c.id ? ' is-dim' : ''}" data-cluster="${c.id}">
        <span class="sg__swatch" style="background:${clusterColor(c.id)}"></span>
        <span class="sg__llabel" title="${escapeHtml(c.label)}">${escapeHtml(c.label)}</span>
        <span class="sg__ln">${c.size}</span>
      </div>`).join('') + `<div class="sg__hint">Click a cluster to dim the others.</div>`
  } else {
    const cat = catById(S.colorBy)
    if (!cat) { legendEl.hidden = true; return }
    const counts = new Map<string, number>()
    for (const n of graph.nodes) { const v = catValue(n, cat); counts.set(v, (counts.get(v) || 0) + 1) }
    const values = [...counts.entries()].sort((a, b) => b[1] - a[1])
    legendEl.innerHTML = `<div class="sg__title">${escapeHtml(cat.label)}</div>` + values.map(([v, n]) => `
      <div class="sg__lrow${focusValue === v ? ' is-focus' : ''}${focusValue !== null && focusValue !== v ? ' is-dim' : ''}" data-value="${escapeHtml(v)}">
        <span class="sg__swatch" style="background:${catColor(cat, v)}"></span>
        <span class="sg__llabel">${escapeHtml(catLabel(cat, v))}</span>
        <span class="sg__ln">${n}</span>
      </div>`).join('') + `<div class="sg__hint">Click one to dim the others.</div>`
  }
}

const hitRow = (h: Hit, kind = true) => `
  <div class="sg__hit${selected?.id === h.id ? ' is-active' : ''}" data-hit="${escapeHtml(h.id)}">
    <span class="sg__score">${Math.round(h.score * 100)}%</span>
    <span class="sg__hlabel" title="${escapeHtml(h.label)}">${escapeHtml(h.label)}</span>
    ${kind && CATEGORIES[0] && nodeById.get(h.id) ? `<span class="sg__hkind">${escapeHtml(catLabel(CATEGORIES[0], catValue(nodeById.get(h.id)!, CATEGORIES[0])))}</span>` : ''}
  </div>`

const renderSide = () => {
  if (!hits.length && !selected && !searchError) { sideEl.hidden = true; return }
  sideEl.hidden = false
  let html = ''
  if (hits.length || searchError) {
    html += `<div class="sg__title">Closest notes <button type="button" data-act="clear">Clear</button></div>`
    if (searchError) html += `<div class="sg__error">${escapeHtml(searchError)}</div>`
    html += hits.map((h) => hitRow(h)).join('')
  }
  if (selected) {
    const n = selected
    html += `<div class="sg__title${hits.length ? ' sg__title--sub' : ''}">Selected</div>
      <div class="sg__sel">${escapeHtml(n.label)}</div>
      <div class="sg__meta">
        ${CATEGORIES.filter((c) => catValue(n, c)).map((c) => `<span class="sg__tag" style="border-color:${catColor(c, catValue(n, c))}" title="${escapeHtml(c.label)}">${escapeHtml(catLabel(c, catValue(n, c)))}</span>`).join('')}
        <span class="sg__tag" style="border-color:${clusterColor(n.cluster)}">${escapeHtml(clusterLabel(n.cluster))}</span>
        ${n.tags.slice(0, 6).map((t) => `<span class="sg__tag">#${escapeHtml(t)}</span>`).join('')}
      </div>
      <button type="button" class="sg__open" data-act="open">${icons.open} Open note</button>
      <div class="sg__title sg__title--sub">Closest in meaning</div>
      ${neighbors.length ? neighbors.map((h) => hitRow(h, false)).join('') : '<div class="sg__hint">Looking…</div>'}`
  }
  sideEl.innerHTML = html
}

const renderMessage = () => {
  if (graph) { msgEl.hidden = true; return }
  msgEl.hidden = false
  if (building) {
    msgEl.innerHTML = `<div>Building the semantic layout…</div><div class="sg__hint">${escapeHtml(status?.build_line || 'starting')}</div>`
  } else if (status?.build_failed) {
    msgEl.innerHTML = `<div>The last build failed.</div><div class="sg__error">${escapeHtml(status.build_failed)}</div>` +
      (opts.allowBuild ? `<button type="button" class="sg__chip sg__primary" data-act="build">Try again</button>` : '')
  } else if (status && !status.ready) {
    msgEl.innerHTML = `<div>The semantic layout has not been built yet.</div>` + (opts.allowBuild
      ? `<div class="sg__hint">${escapeHtml(opts.buildIntro)}</div>
         <button type="button" class="sg__chip sg__primary" data-act="build">Build it now</button>`
      : `<div class="sg__hint">${escapeHtml(opts.buildHint)}</div>`)
  } else {
    msgEl.textContent = 'Loading the semantic graph…'
  }
}

const loadGraph = async () => {
  const g = initialData && initialData.ready ? initialData : await host.request<Graph>('semanticGraph', { scope: S.scope })
  initialData = undefined
  if (destroyed) return
  if (!g || !g.ready || !g.nodes.length) { graph = null; return }
  graph = g
  indexCategories()
  nodeById.clear()
  for (const n of g.nodes) nodeById.set(n.id, n)
  selected = null; neighbors = []; hits = []; highlighted = new Set(); focusCluster = null; focusValue = null
  hudEl.textContent = hudText(g.nodes.length, g.links.length)
  ensureGraph()
  render()
  renderLegend()
  renderSide()
  host.notify?.('ready', { nodes: g.nodes.length, links: g.links.length })
}

// -------------------------------------------------------------- settings
const section = (id: Section, title: string, body: string, tools = '') => `
<section class="sg__sec${S.open[id] ? '' : ' is-closed'}" data-sec="${id}">
  <header class="sg__sec-h">
    <button type="button" class="sg__sec-t" data-toggle="${id}">${S.open[id] ? icons.chevronDown : icons.chevronRight}${title}</button>
    ${tools}
  </header>
  <div class="sg__sec-b">${body}</div>
</section>`
const toggleRow = (label: string, key: string, on: boolean) => `
<label class="sg__row"><span>${label}</span><span class="sg__switch"><input type="checkbox" data-switch="${key}"${on ? ' checked' : ''}><span></span></span></label>`
const sliderRow = (label: string, key: keyof Display, min: number, max: number, step: number) => `
<label class="sg__slider"><span>${label}</span><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${S.display[key]}"></label>`
const groupRows = () => S.groups.map((g, i) => `
<div class="sg__group">
  <input type="text" class="sg__group-q" data-group-q="${i}" value="${escapeHtml(g.query)}" placeholder="path:concepts, cluster:name …" spellcheck="false" autocapitalize="off" autocorrect="off">
  <label class="sg__gswatch" style="background:${escapeHtml(g.color)}" title="Colour"><input type="color" data-group-c="${i}" value="${escapeHtml(g.color)}"></label>
  <button type="button" class="sg__x" data-group-x="${i}" title="Remove group">${icons.close}</button>
</div>`).join('') + `<button type="button" class="sg__new" data-pact="new-group">New group</button>`
const renderPanel = () => {
  panelEl.hidden = !S.panel
  positionPanels()
  if (!S.panel) return
  panelEl.innerHTML =
    section('filters', 'Filters', `
      <label class="sg__psearch">${icons.search}
        <input type="text" data-bind="filter" value="${escapeHtml(filterText)}" placeholder="Show only matching notes…" spellcheck="false" autocapitalize="off" autocorrect="off">
      </label>
      <div class="sg__hint">path:folder &nbsp; file:name &nbsp; tag:name &nbsp; folder:stories &nbsp; cluster:name &nbsp; -not</div>`,
      `<span class="sg__sec-tools">
        <button type="button" data-pact="reset" title="Restore default settings">${icons.reset}</button>
        <button type="button" data-pact="close" title="Close">${icons.close}</button>
      </span>`) +
    section('groups', 'Groups', `<div class="sg__hint">A group colours the notes it matches, over the cluster or folder colour. The first match wins.</div><div data-groups class="sg__groups">${groupRows()}</div>`) +
    section('display', 'Display',
      sliderRow('Node size', 'nodeSize', 0.2, 4, 0.1) +
      sliderRow('Spread', 'spread', 0.4, 2.5, 0.05) +
      sliderRow('Link thickness', 'linkThickness', 0, 4, 0.1) +
      sliderRow('Link opacity', 'linkOpacity', 0.05, 1, 0.05) +
      sliderRow('Particle size', 'particleSize', 0.5, 6, 0.1) +
      sliderRow('Particle count', 'particleCount', 0, 10, 1) +
      sliderRow('Cluster region opacity', 'regionOpacity', 0, 0.3, 0.01) +
      toggleRow('Name labels', 'labels', S.display.labels))
}
const renderGroups = () => {
  const el = panelEl.querySelector<HTMLElement>('[data-groups]')
  if (el) el.innerHTML = groupRows()
}
const regroup = () => { compileGroups(); repaint(); renderSide() }
let filterTimer: ReturnType<typeof setTimeout> | null = null
panelEl.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-toggle],[data-pact],[data-group-x]')
  if (!t) return
  if (t.dataset.toggle) {
    const id = t.dataset.toggle as Section
    S.open[id] = !S.open[id]
    panelEl.querySelector(`[data-sec="${id}"]`)?.classList.toggle('is-closed', !S.open[id])
    t.innerHTML = (S.open[id] ? icons.chevronDown : icons.chevronRight) + escapeHtml(t.textContent || '')
    persist()
    return
  }
  if (t.dataset.groupX != null) { S.groups.splice(Number(t.dataset.groupX), 1); renderGroups(); regroup(); persist(); return }
  switch (t.dataset.pact) {
    case 'close': S.panel = false; persist(); renderToolbar(); renderPanel(); break
    case 'new-group':
      S.groups.push({ query: '', color: NEW_GROUP_COLORS[S.groups.length % NEW_GROUP_COLORS.length] })
      renderGroups(); persist()
      panelEl.querySelector<HTMLInputElement>(`[data-group-q="${S.groups.length - 1}"]`)?.focus()
      break
    case 'reset': {
      const d = defaults()
      S.groups = d.groups; S.display = d.display; filterText = ''; S.filter = ''
      compileGroups(); resizeNodes(); applySpread(); applyFilter()
      if (fg) fg.linkOpacity(S.display.linkOpacity).linkDirectionalParticleWidth(S.display.particleSize)
      renderPanel(); persist()
      break
    }
  }
})
panelEl.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement
  if (t.dataset.bind === 'filter') {
    filterText = t.value
    S.filter = t.value
    persist()
    if (filterTimer) clearTimeout(filterTimer)
    filterTimer = setTimeout(() => applyFilter(), 200)
    return
  }
  if (t.dataset.groupQ != null) { S.groups[Number(t.dataset.groupQ)].query = t.value; regroup(); persist(); return }
  if (t.dataset.groupC != null) {
    S.groups[Number(t.dataset.groupC)].color = t.value
    ;(t.parentElement as HTMLElement).style.background = t.value
    regroup(); persist(); return
  }
  const key = t.dataset.range as keyof Display | undefined
  if (!key) return
  ;(S.display as any)[key] = Number(t.value)
  if (key === 'nodeSize') resizeNodes()
  else if (key === 'spread') applySpread()
  else if (key === 'linkOpacity') fg?.linkOpacity(S.display.linkOpacity)
  else if (key === 'particleSize') fg?.linkDirectionalParticleWidth(S.display.particleSize)
  else if (key === 'regionOpacity') drawHulls()
  else light()
  persist()
})
panelEl.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement
  if (t.dataset.switch === 'labels') { S.display.labels = t.checked; labelLit(); persist() }
})

// ---------------------------------------------------------------- events
app.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-color],[data-scope],[data-cluster],[data-value],[data-hit]')
  if (!t) return
  if (t.dataset.scope) {
    if (t.dataset.scope === S.scope) return
    S.scope = t.dataset.scope
    persist(); renderToolbar()
    void loadGraph().then(() => { renderToolbar(); renderMessage() }).catch(fail)
    return
  }
  if (t.dataset.color) {
    S.colorBy = t.dataset.color as ColorMode
    focusCluster = null; focusValue = null
    persist(); repaint(); drawHulls(); renderToolbar(); renderLegend()
    return
  }
  if (t.dataset.cluster != null) {
    const id = Number(t.dataset.cluster)
    focusCluster = focusCluster === id ? null : id
    repaint(); renderLegend()
    return
  }
  if (t.dataset.value != null) {
    focusValue = focusValue === t.dataset.value ? null : t.dataset.value!
    repaint(); renderLegend()
    return
  }
  if (t.dataset.hit) {
    selectById(t.dataset.hit, true)
    const n = nodeById.get(t.dataset.hit)
    if (n && host.platform !== 'ios') openNote(n)
    return
  }
  switch (t.dataset.act) {
    case 'links':
      S.links = !S.links
      applyFilter()
      persist(); renderToolbar(); break
    case 'hulls': S.hulls = !S.hulls; drawHulls(); persist(); renderToolbar(); break
    case 'legend': S.legend = !S.legend; persist(); renderToolbar(); renderLegend(); break
    case 'panel': S.panel = !S.panel; persist(); renderToolbar(); renderPanel(); break
    case 'orbit': setOrbit(!S.orbit); break
    case 'stop': stopOrbit(); break
    case 'slower': changeSpeed(-1); break
    case 'faster': changeSpeed(1); break
    case 'clear': clearSearch(); renderToolbar(); break
    case 'build': void startBuild(); break
    case 'open': if (selected) openNote(selected); break
  }
})
toolbarEl.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement
  if (t.dataset.bind === 'q') query = t.value
})
toolbarEl.addEventListener('keydown', (e) => {
  const t = e.target as HTMLInputElement
  if (t.dataset?.bind !== 'q') return
  if (e.key === 'Enter') { e.preventDefault(); t.blur(); void search() }
  else if (e.key === 'Escape') { clearSearch(); renderToolbar() }
})
toolbarEl.addEventListener('search', (e) => {
  const t = e.target as HTMLInputElement
  if (t.dataset?.bind === 'q' && !t.value && (hits.length || searchError)) clearSearch()
})
const toolbarObserver = new ResizeObserver(() => positionPanels())
toolbarObserver.observe(toolbarEl)

// ------------------------------------------------------------------ boot
const start = async () => {
  renderToolbar()
  renderPanel()
  renderMessage()
  try {
    if (!status) status = await host.request<Status>('semanticStatus')
    building = !!status?.building
    if (status?.ready) await loadGraph()
    renderToolbar()
    renderMessage()
    if (building) pollBuild()
  } catch (err) {
    fail(err)
  }
}
const fail = (err: unknown) => {
  if (destroyed) return
  msgEl.hidden = false
  msgEl.textContent = 'Could not load the semantic graph.'
  host.notify?.('failed', { message: err instanceof Error ? err.message : 'unknown' })
}
const openNote = (n: SNode) => host.open({ id: n.id, note: n.id, title: n.label, quote: '', path: n.path, raw: n })
const destroy = () => {
  if (destroyed) return
  destroyed = true
  cancelAnimationFrame(entryFrame)
  for (const t of [entryTimer, pollTimer, filterTimer]) if (t) clearTimeout(t)
  toolbarObserver.disconnect()
  canvasObserver?.disconnect()
  if (fg) { fg.pauseAnimation?.(); fg._destructor?.(); fg = null }
  app.innerHTML = ''
}
const page: GraphPage = { destroy }
start()
return page
}
