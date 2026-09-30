// The Meridian Archive's graph settings: sources, colours, categories and scopes.
// A good starting point for your own data: copy it and change the folders.
import type { GraphSource, Group, SemanticCategory, SemanticNodeData } from '../src/index'

const FOLDER_COLORS: Record<string, string> = {
  worlds: '#52b1e0', species: '#52e052', tech: '#e0b152', crew: '#e052b1', missions: '#e05252', logs: '#b152e0', maps: '#ffffff',
}
const groups = (colors: Record<string, string>): Group[] => Object.entries(colors).map(([folder, color]) => ({ query: `path:${folder}/`, color }))
// The Graphify view uses the same colours moved to other folders, so the two views are easy to tell apart.
const SWAPPED: Record<string, string> = {
  worlds: '#e0b152', species: '#52b1e0', tech: '#b152e0', crew: '#52e0b1', missions: '#e052b1', logs: '#e05252', maps: '#ffffff',
}

export const SOURCES: GraphSource[] = [
  {
    id: 'links', label: 'Links', title: 'The [[links]] written between notes',
    settingsKey: 'meridian.2d.links', groups: groups(FOLDER_COLORS), noun: 'notes',
    loadingText: 'Reading the archive…', emptyText: 'The archive is empty.',
  },
  {
    id: 'graphify', label: 'Graphify', title: 'The ideas Graphify found in the notes, and how they connect',
    settingsKey: 'meridian.2d.graphify', graphify: true, groups: groups(SWAPPED), noun: 'nodes',
    loadingText: 'Reading the Graphify graph…', emptyText: 'The Graphify graph has not been built yet.',
  },
]

const STATUS: Record<string, string> = { succeeded: '#22c55e', failed: '#ef4444', active: '#3f7fe0', planned: '#f59e0b', lost: '#8b5cf6' }
const YEARS = ['#e0498a', '#f28c28', '#3dbb5b', '#3f7fe0', '#8b5cf6', '#22b8cf', '#e5484d', '#14b8a6']

export const CATEGORIES: SemanticCategory[] = [
  { id: 'folder', label: 'Folder', field: 'folder', colors: { ...FOLDER_COLORS, root: '#9aa1ad' },
    labels: { worlds: 'Worlds', species: 'Species', tech: 'Technology', crew: 'Crew', missions: 'Missions', logs: 'Logs', maps: 'Maps', root: 'Fragments' } },
  { id: 'status', label: 'Status', field: 'status', colors: STATUS },
  { id: 'year', label: 'Year', field: 'year', colorOf: (y) => { const n = Number(y); return n ? YEARS[(n - 2187) % YEARS.length] : undefined } },
  { id: 'sector', label: 'Sector', field: 'sector' },
]

export const SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'missions', label: 'Missions' },
]
export const SCOPE_RULES: Record<string, (n: SemanticNodeData) => boolean> = {
  knowledge: (n) => n.folder !== 'missions',
  missions: (n) => n.folder === 'missions',
}
