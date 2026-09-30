// The single-file scripts (dist/standalone/*.js) fill a page or an iOS/macOS
// web view. Each reads window.KnowledgeGraphConfig
// and mounts into #app. Everything in the config is plain JSON, so a native app
// can write it into the page.
import type { GraphHost, GraphSource, OpenTarget, SemanticCategory } from '../host'
import { createHost, createStaticSemantic, type GraphData, type SemanticDataset } from '../host-helpers'
// @ts-expect-error bundled as text by esbuild
import standaloneCss from './standalone.css'

export interface StandaloneSource extends GraphSource {
  /** The graph itself, or a URL to fetch it from. */
  data?: GraphData
  url?: string
}
export interface StandaloneConfig {
  /** 2D and 3D Knowledge Graphs: the sources to switch between. */
  sources?: StandaloneSource[]
  initialSource?: string
  /** 3D Semantic Graph. A scope keeps the nodes whose `field` is one of `values`; no field keeps all. */
  semantic?: {
    data?: SemanticDataset
    url?: string
    categories?: SemanticCategory[]
    scopes?: { id: string; label: string; field?: string; values?: string[] }[]
    defaultScope?: string
    buildIntro?: string
    buildHint?: string
  }
  /** Settings saved earlier, by key; otherwise the browser's storage is used. */
  settings?: Record<string, string>
  compact?: boolean
  accent?: string
  platform?: 'macos' | 'ios' | 'web'
  debug?: boolean
}

declare global {
  interface Window {
    KnowledgeGraphConfig?: StandaloneConfig
    webkit?: { messageHandlers?: Record<string, { postMessage: (msg: unknown) => void }> }
  }
}

/**
 * Where an opened node and a changed setting go: to a native app through the
 * `knowledgeGraph` script message handler when there is one, and always as a
 * `knowledgegraph:open` event on window.
 */
const nativeHandler = () => window.webkit?.messageHandlers?.knowledgeGraph

export function standaloneConfig(): StandaloneConfig {
  return window.KnowledgeGraphConfig || {}
}

export function standaloneHost(c: StandaloneConfig): GraphHost {
  const graphs: Record<string, GraphData | string> = {}
  for (const s of c.sources || []) { if (s.data) graphs[s.id] = s.data; else if (s.url) graphs[s.id] = s.url }
  const sem = c.semantic
  const saved = new Map(Object.entries(c.settings || {}))
  const native = nativeHandler()
  return createHost({
    graphs,
    semantic: sem && (sem.data || sem.url) ? createStaticSemantic((sem.data || sem.url)!, {
      scopes: Object.fromEntries((sem.scopes || []).filter((x) => x.field).map((x) => [x.id, (n) => (x.values || []).includes(String(n[x.field!] ?? ''))])),
    }) : undefined,
    onOpen: (t: OpenTarget) => {
      native?.postMessage({ type: 'open', id: t.id, note: t.note, title: t.title, quote: t.quote, path: t.path })
      window.dispatchEvent(new CustomEvent('knowledgegraph:open', { detail: t }))
    },
    // A native app keeps settings itself; a browser uses localStorage.
    storage: native ? {
      get: (k) => saved.get(k) ?? null,
      set: (k, v) => { saved.set(k, v); native.postMessage({ type: 'settings', key: k, json: v }) },
    } : 'local',
    compact: c.compact, accent: c.accent, platform: c.platform, debug: c.debug,
    onNotify: (type, payload) => native?.postMessage({ type, ...(payload || {}) }),
  })
}

/** The full-page element a standalone script mounts into, with the page-wide styles. */
export function appRoot(): HTMLElement {
  if (!document.getElementById('kg-standalone')) {
    const style = document.createElement('style')
    style.id = 'kg-standalone'
    style.textContent = standaloneCss
    document.head.appendChild(style)
  }
  return document.getElementById('app') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }))
}
