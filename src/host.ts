// What a graph page needs from the app it is mounted in. The same three pages
// run in a plain web page, inside React or Vue, or filling an iOS/macOS web
// view; everything app-specific comes through the host or the page's options.
// createHost() (host-helpers.ts) builds a host from data you already have.

export type Platform = 'macos' | 'ios' | 'web'

export interface Group { query: string; color: string }

/** A node the user asked to open. The host decides where it goes. */
export interface OpenTarget {
  id: string
  /** The note to open, or null when the node has none. */
  note: string | null
  title: string
  /** A passage to find and highlight in the note (Graphify nodes send their name). */
  quote: string
  path?: string
  /** The node as the host delivered it, for host-specific fields (a matter's code…). */
  raw?: unknown
}

export interface GraphHost {
  platform: Platform
  /** A phone-width screen: panels start closed and taps select first. */
  compact: boolean
  /** Accent colour as #rrggbb. */
  accent?: string
  /** Ask the host for data: `graph` ({ source }), `semanticStatus`, `semanticGraph` … */
  request<T>(type: string, payload?: Record<string, unknown>): Promise<T>
  open(target: OpenTarget): void
  loadSetting(key: string): string | null
  saveSetting(key: string, value: unknown): void
  /** Informational: `ready`, `failed`. */
  notify?(type: string, payload?: Record<string, unknown>): void
  /** Expose inspection handles on window (__kg2d, __kg3d, __kgSemantic) for tests and devtools. */
  debug?: boolean
}

/** One graph a Knowledge Graph page can draw, switched at its top left. */
export interface GraphSource {
  id: string
  label: string
  /** Tooltip on the switch. */
  title?: string
  /** Where this source's own settings are kept. */
  settingsKey: string
  /** Bump when the default colours change, so saved settings pick them up. */
  settingsVersion?: number
  /** Graphify semantics: communities, kinds, inferred links, hubs, note + quote on open. */
  graphify?: boolean
  /** Default colour groups, first match wins. */
  groups: Group[]
  /** What a node is called in the status line. */
  noun?: string
  /** Shown while the graph loads, and when it has nothing in it. */
  loadingText?: string
  emptyText?: string
}

/** A way to colour the 3D Semantic Graph besides its clusters. */
export interface SemanticCategory {
  id: string
  label: string
  /** The node field it reads (`folder`, `kind`, `status`, `year` …). */
  field: string
  /** Fixed colours by value; values without one take the palette. */
  colors?: Record<string, string>
  /** A colour rule, tried before `colors` (for example, colour a status by its prefix). */
  colorOf?: (value: string) => string | undefined
  /** Display names by value. */
  labels?: Record<string, string>
}

// ---------------------------------------------------------------- helpers

const path = (d: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
export const icons = {
  chevronDown: path('<path d="m6 9 6 6 6-6"/>'),
  chevronRight: path('<path d="m9 6 6 6-6 6"/>'),
  close: path('<path d="M18 6 6 18M6 6l12 12"/>'),
  reset: path('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  search: path('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  plus: path('<path d="M12 5v14M5 12h14"/>'),
  minus: path('<path d="M5 12h14"/>'),
  fit: path('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  gear: path('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  play: path('<path d="m7 4 13 8-13 8z" fill="currentColor"/>'),
  pause: path('<path d="M7 4v16M17 4v16"/>'),
  stop: path('<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>'),
  open: path('<path d="M7 17 17 7M8 7h9v9"/>'),
  layers: path('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))

/** Add a page's stylesheet once, however often it is mounted. */
export function injectStyle(id: string, css: string): void {
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.appendChild(style)
}

/** Handle returned by every mount: tears the page down completely. */
export interface GraphPage { destroy(): void }
