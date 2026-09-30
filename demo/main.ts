// The demo: The Meridian Archive, with the three graphs as tabs and a note
// panel that opens when a node is opened.
import { createHost, createStaticSemantic, mount3D, mountKnowledge, mountSemantic, type GraphPage, type OpenTarget } from '../src/index'
import { CATEGORIES, SCOPES, SCOPE_RULES, SOURCES } from './meridian'

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
const stage = $('#stage')
const drawer = $('#note')
let notes: Record<string, string> | null = null
const loadNotes = async () => notes ||= await (await fetch('data/notes.json')).json()

// ------------------------------------------------------------ the note panel
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const inline = (s: string) => esc(s)
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target, label) => `<a href="#" data-note="${esc(target)}">${label}</a>`)
  .replace(/\[\[([^\]]+)\]\]/g, (_, target) => `<a href="#" data-note="${esc(target)}">${target}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
function renderMarkdown(md: string) {
  const fm = md.match(/^---\n([\s\S]*?)\n---\n/)
  const meta = fm ? Object.fromEntries(fm[1].split('\n').map((l) => l.split(/:\s*/, 2)).filter((kv) => kv.length === 2)) : {}
  const body = fm ? md.slice(fm[0].length) : md
  const html = body.trim().split(/\n{2,}/).map((block) => {
    if (block.startsWith('## ')) return `<h3>${inline(block.slice(3))}</h3>`
    if (block.startsWith('# ')) return ''
    if (block.startsWith('- ')) return `<ul>${block.split('\n').map((l) => `<li>${inline(l.replace(/^- /, ''))}</li>`).join('')}</ul>`
    return `<p>${inline(block)}</p>`
  }).join('')
  const chips = ['type', 'status', 'year', 'sector', 'role'].filter((k) => meta[k]).map((k) => `<span class="chip">${esc(k)}: ${esc(String(meta[k]).replace(/^"|"$/g, ''))}</span>`).join('')
  const tags = (meta.tags || '').replace(/^\[|\]$/g, '').split(',').map((t: string) => t.trim()).filter(Boolean).map((t: string) => `<span class="chip tag">#${esc(t)}</span>`).join('')
  return { title: String(meta.title || '').replace(/^"|"$/g, ''), html, chips: chips + tags }
}
const byBasename = (name: string) => Object.keys(notes!).find((id) => id.split('/').pop() === `${name}.md`)
async function openNote(id: string, quote = '') {
  await loadNotes()
  const md = notes![id]
  if (!md) return
  const { title, html, chips } = renderMarkdown(md)
  drawer.hidden = false
  drawer.innerHTML = `<button class="close" aria-label="Close">×</button>
    <div class="path">${esc(id)}</div><h2>${esc(title || id)}</h2><div class="chips">${chips}</div><div class="md">${html}</div>`
  // The passage a Graphify node came from, highlighted where it first appears.
  if (quote) {
    const walker = document.createTreeWalker(drawer.querySelector('.md')!, NodeFilter.SHOW_TEXT)
    const q = quote.toLowerCase()
    for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
      const i = t.data.toLowerCase().indexOf(q)
      if (i < 0) continue
      const mark = document.createElement('mark')
      const hit = t.splitText(i)
      hit.splitText(quote.length)
      mark.textContent = hit.data
      hit.replaceWith(mark)
      mark.scrollIntoView({ block: 'center' })
      break
    }
  }
}
drawer.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-note]')
  if (a) { e.preventDefault(); const id = byBasename(a.dataset.note!); if (id) void openNote(id) }
  if ((e.target as HTMLElement).closest('.close')) drawer.hidden = true
})

// ------------------------------------------------------------ the graphs
const host = createHost({
  graphs: { links: 'data/links.json', graphify: 'data/graphify.json' },
  semantic: createStaticSemantic('data/semantic.json', { scopes: SCOPE_RULES }),
  onOpen: (t: OpenTarget) => { if (t.note) void openNote(t.note, t.quote) },
  storagePrefix: 'meridian-demo.',
  debug: new URLSearchParams(location.search).has('debug'),
})

let page: GraphPage | null = null
const TABS = ['2d', '3d', 'semantic'] as const
type Tab = typeof TABS[number]
function show(tab: Tab) {
  page?.destroy()
  stage.innerHTML = ''
  const el = stage.appendChild(document.createElement('div'))
  el.className = 'graph'
  page = tab === '2d' ? mountKnowledge(el, host, { sources: SOURCES, sourceKey: 'meridian.2d.source' })
    : tab === '3d' ? mount3D(el, host, { sources: SOURCES, settingsKey: 'meridian.3d.settings' })
      : mountSemantic(el, host, {
        settingsKey: 'meridian.semantic.settings', categories: CATEGORIES, scopes: SCOPES, defaultScope: 'all',
        allowBuild: false, buildIntro: '', buildHint: 'Run tools/semantic/build.py to build the layout.',
      })
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab))
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`)
}
document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as Tab)))
const fromHash = () => { const t = location.hash.slice(1) as Tab; return TABS.includes(t) ? t : '2d' }
// Back, forward and edited links switch the graph too.
window.addEventListener('hashchange', () => { if (!document.querySelector(`[data-tab="${fromHash()}"].is-active`)) show(fromHash()) })
show(fromHash())
void loadNotes()
