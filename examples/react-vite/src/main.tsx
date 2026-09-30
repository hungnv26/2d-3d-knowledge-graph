import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createStaticSemantic, type GraphSource, type OpenTarget } from '2d-3d-knowledge-graph'
import { KnowledgeGraph2D, KnowledgeGraph3D, SemanticGraph3D } from '2d-3d-knowledge-graph/react'

// Two sources for the Knowledge Graphs: the links between notes, and the Graphify graph.
const sources: GraphSource[] = [
  { id: 'links', label: 'Links', settingsKey: 'react-demo.links', noun: 'notes',
    groups: [{ query: 'path:worlds/', color: '#52b1e0' }, { query: 'path:species/', color: '#52e052' }, { query: 'path:tech/', color: '#e0b152' }, { query: 'path:maps/', color: '#ffffff' }] },
  { id: 'graphify', label: 'Graphify', settingsKey: 'react-demo.graphify', graphify: true, noun: 'nodes',
    groups: [{ query: 'path:worlds/', color: '#e0b152' }, { query: 'path:species/', color: '#52b1e0' }] },
]
const graphs = { links: '/links.json', graphify: '/graphify.json' }
const semantic = createStaticSemantic('/semantic.json')

function App() {
  const [tab, setTab] = useState<'2d' | '3d' | 'semantic'>('2d')
  const [opened, setOpened] = useState<OpenTarget | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <nav style={{ display: 'flex', gap: 8, padding: 8 }}>
        {(['2d', '3d', 'semantic'] as const).map((t) => <button key={t} onClick={() => setTab(t)} disabled={tab === t}>{t}</button>)}
        {opened && <span style={{ marginLeft: 'auto' }}>Opened: {opened.note} {opened.quote && `(at “${opened.quote}”)`}</span>}
      </nav>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === '2d' && <KnowledgeGraph2D sources={sources} graphs={graphs} onOpen={setOpened} />}
        {tab === '3d' && <KnowledgeGraph3D sources={sources} graphs={graphs} onOpen={setOpened} />}
        {tab === 'semantic' && <SemanticGraph3D semantic={semantic} categories={[{ id: 'folder', label: 'Folder', field: 'folder' }]} onOpen={setOpened} />}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
