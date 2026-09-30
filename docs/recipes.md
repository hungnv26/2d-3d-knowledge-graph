# Recipes

## Next.js (App Router)

```tsx
// app/graph/GraphClient.tsx
'use client'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

// The graphs use window and WebGL: load them in the browser only.
const KnowledgeGraph2D = dynamic(() => import('2d-3d-knowledge-graph/react').then((m) => m.KnowledgeGraph2D), { ssr: false })

const sources = [
  { id: 'links', label: 'Links', settingsKey: 'site.links', groups: [{ query: 'path:blog/', color: '#52b1e0' }] },
]

export default function GraphClient() {
  const router = useRouter()
  return (
    <div style={{ height: '80vh' }}>
      <KnowledgeGraph2D sources={sources} graphs={{ links: '/graph/links.json' }}
        onOpen={(t) => router.push('/' + (t.note ?? t.id).replace(/\.md$/, ''))} />
    </div>
  )
}
```

Generate `public/graph/links.json` at build time:

```json
{ "scripts": { "prebuild": "kg-links content --out public/graph/links.json" } }
```

## A folder of Markdown notes, or an Obsidian vault

```bash
npx kg-links ~/vault --exclude .obsidian --exclude templates/ --out links.json
uv run tools/semantic/build.py ~/vault --out semantic.json --fields status --cache .emb-cache.json
```

For the Graphify view, run Graphify on the vault first (`graphify ~/vault`), then:

```bash
npx kg-graphify ~/vault/graphify-out/graph.json --notes ~/vault --out graphify.json
```

## A REST API or a database

Map your records to `{ nodes, edges }` wherever it is cheapest, and hand the graph a loader:

```ts
const host = createHost({
  graphs: {
    links: async () => {
      const [docs, refs] = await Promise.all([api.get('/documents'), api.get('/references')])
      return {
        nodes: docs.map((d) => ({ id: d.id, title: d.title, path: `${d.team}/${d.slug}`, tags: d.labels, url: d.url })),
        edges: refs.map((r) => ({ from: r.fromId, to: r.toId })),
      }
    },
  },
  // `raw` is your node, so extra fields such as `url` come back on open.
  onOpen: (t) => { location.href = (t.raw as { url: string }).url },
})
```

## Server-side semantic search

Embed the query with the same model that built the layout, and search your vector store:

```ts
const semantic: SemanticProvider = {
  status: () => fetch('/api/semantic/status').then((r) => r.json()),
  graph: (scope) => fetch(`/api/semantic/layout?scope=${scope ?? ''}`).then((r) => r.json()),
  search: (q, limit, scope) => fetch(`/api/semantic/search?q=${encodeURIComponent(q)}&limit=${limit}&scope=${scope ?? ''}`).then((r) => r.json()),
  neighbors: (id, limit) => fetch(`/api/semantic/neighbors?id=${encodeURIComponent(id)}&limit=${limit}`).then((r) => r.json()),
  build: () => fetch('/api/semantic/build', { method: 'POST' }).then((r) => r.json()), // pair with allowBuild: true
}
```

## Highlight the passage a Graphify node came from

`onOpen` gives you `quote`, the node's own name. When you render the note, find the first occurrence and wrap it in a `<mark>`, then scroll it into view. See `demo/main.ts` (`openNote`) for a complete example.

## Keep settings on your server

```ts
createHost({
  storage: {
    get: (key) => userPrefs[key] ?? null,
    set: (key, value) => { userPrefs[key] = value; void savePrefs(userPrefs) },
  },
})
```

Settings are saved each time they change. Debounce `savePrefs` if your server needs it.
