# API

```ts
import {
  mountKnowledge, mount3D, mountSemantic,   // the three graphs
  createHost, createStaticSemantic,         // ready-made data plumbing
} from '2d-3d-knowledge-graph'
import { KnowledgeGraph2D, KnowledgeGraph3D, SemanticGraph3D } from '2d-3d-knowledge-graph/react' // or /vue
```

Every mount function takes `(element, host, options)`. It fills `element` and returns `{ destroy() }`.

## The host

A graph asks its host for data, tells it when a node is opened, and keeps its settings through it:

```ts
interface GraphHost {
  platform: 'macos' | 'ios' | 'web'
  compact: boolean                  // phone layout: panels start closed, taps select first
  accent?: string                   // #rrggbb, for switches and highlighted links
  request<T>(type: string, payload?: Record<string, unknown>): Promise<T>
  open(target: OpenTarget): void
  loadSetting(key: string): string | null
  saveSetting(key: string, value: unknown): void
  notify?(type: 'ready' | 'failed', payload?: Record<string, unknown>): void
  debug?: boolean                   // expose window.__kg2d / __kg3d / __kgSemantic for tests
}
interface OpenTarget { id: string; note: string | null; title: string; quote: string; path?: string; raw?: unknown }
```

Requests a graph makes:

| type | payload | answer |
|---|---|---|
| `graph` | `{ source }` | a Links or Graphify graph |
| `semanticStatus` | | `{ ready, building, build_line, build_failed, built_at?, stale? }` |
| `semanticGraph` | `{ scope? }` | a semantic layout with `ready: true` |
| `semanticSearch` | `{ query, limit, scope? }` | `{ results: [{ id, label, score }], error? }` |
| `semanticNeighbors` | `{ id, limit }` | `{ results }` |
| `semanticBuild` | | `{ started?, error? }` (only if `allowBuild`) |

### `createHost(options)`

```ts
createHost({
  graphs?: Record<string, GraphData | string | (() => Promise<GraphData>)>, // per source id: data, URL or loader (cached)
  semantic?: SemanticProvider,
  onOpen?: (t: OpenTarget) => void,
  storage?: 'local' | 'memory' | { get(k): string | null; set(k, v): void }, // default 'local'
  storagePrefix?: string,
  accent?: string, compact?: boolean, platform?: Platform, debug?: boolean,
  onNotify?: (type, payload) => void,
})
```

### `createStaticSemantic(dataOrUrl, { scopes?, embed? })`

Serves a layout written by `tools/semantic/build.py`, entirely in the browser.

- **Closest in meaning** uses the stored vectors.
- **Search:**
  - Without `embed`, the notes whose titles and tags best match the words seed the search, and every note is ranked by closeness to them.
  - With `embed(text) => Promise<number[]>`, a model of the same kind, reduced to the same number of dimensions, gives true search by meaning.
  - For real semantic search in production, implement a `SemanticProvider` on your server.
- **`scopes`:** `{ scopeId: (node) => boolean }`. A scope without a rule keeps everything.

## `mountKnowledge(el, host, options)`: 2D Knowledge Graph

```ts
{
  sources: GraphSource[]     // switched at the top left; the first is the default
  sourceKey: string          // where the last-shown source is remembered
  initialSource?: string     // open on this one instead
  initialData?: GraphData    // the first source's graph, if you already have it
}
interface GraphSource {
  id: string; label: string; title?: string
  settingsKey: string        // this source's own settings
  settingsVersion?: number   // bump when you change default groups, to reset saved ones
  graphify?: boolean         // communities, kinds, inferred links, Hubs mode, open at the passage
  groups: { query: string; color: string }[]
  noun?: string              // "notes", "nodes", "people" … in the status line
  loadingText?: string; emptyText?: string
}
```

**Query language**, used by Filters and Groups:
- Terms are combined with AND.
- Field searches: `path:`, `file:`, `tag:`, `community:` and `type:`.
- `-term` excludes; `"quoted phrase"` keeps the spaces.
- A bare word matches the title, path, tags or community.

## `mount3D(el, host, options)`: 3D Knowledge Graph

```ts
{ sources: GraphSource[]; settingsKey: string; initialData?: GraphData }
```

## `mountSemantic(el, host, options)`: 3D Semantic Graph

```ts
{
  settingsKey: string
  categories: SemanticCategory[]              // colour modes besides Cluster, and query fields
  scopes?: { id: string; label: string }[]    // sent as `scope` with every request
  defaultScope?: string
  allowBuild: boolean                         // show Build/Rebuild (host must answer semanticBuild)
  buildIntro: string                          // shown with the Build button when nothing is built
  buildHint: string                           // shown instead when this user cannot build
  initialStatus?: unknown; initialData?: unknown
}
interface SemanticCategory {
  id: string; label: string; field: string    // the node field it reads
  colors?: Record<string, string>             // fixed colours by value
  colorOf?: (value: string) => string | undefined  // or a rule
  labels?: Record<string, string>             // display names by value
}
```

## React and Vue

`<KnowledgeGraph2D>` and `<KnowledgeGraph3D>` take:
- `sources`, plus either `graphs` or `host`;
- optionally `sourceKey`, `initialSource` (2D) or `settingsKey` (3D);
- optionally `storage`, `storagePrefix`, `accent`, `compact` and `debug`.

`<SemanticGraph3D>` takes:
- either `semantic` or `host`;
- `categories`, `scopes`, `defaultScope` and `settingsKey`;
- `allowBuild`, `buildIntro` and `buildHint`.

Events:
- React: `onOpen(target)` and `onNotify(type, payload)`.
- Vue: `@open` and `@notify`.

The components fill their box: `width: 100%`, `height: 100%`, `min-height: 320px`. Give the parent a height. Props are read at mount; change `key` to remount with new ones.

## Standalone scripts

`dist/standalone/{knowledge,force3d,semantic}-graph.js` each read `window.KnowledgeGraphConfig` and fill `#app`:

```ts
{
  sources?: (GraphSource & { data?: GraphData; url?: string })[]
  initialSource?: string
  semantic?: { data?, url?, categories?, scopes?: { id, label, field?, values? }[], defaultScope?, buildIntro?, buildHint? }
  settings?: Record<string, string>   // saved settings, if a native app keeps them
  compact?: boolean; accent?: string; platform?: 'macos' | 'ios' | 'web'; debug?: boolean
}
```

Opened nodes are sent in two ways:
- as a `knowledgegraph:open` event on `window`;
- in a web view, to the `knowledgeGraph` script message handler as `{ type: 'open', id, note, title, quote }`. Settings go to the same handler as `{ type: 'settings', key, json }`.
