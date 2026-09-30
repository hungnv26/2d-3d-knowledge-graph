#!/usr/bin/env node
// The Meridian Archive: the recovered knowledge vault of the starship Meridian,
// a fictional deep-space survey expedition (2187-2194). Every word is invented.
//
// Writes, deterministically (same seed, same archive):
//   sample-data/meridian/notes/**.md          about 660 Markdown notes with [[links]], tags, front matter
//   sample-data/meridian/graphify-out/graph.json  a graph in Graphify's own output format
// Then run `npm run sample-data:build` to turn them into links.json, graphify.json
// and semantic.json with the package's tools.
//
// Part of the 2D-3D Knowledge Graph Package by Hung Ngo (MIT).
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, 'meridian')
const NOTES = join(OUT, 'notes')

// ------------------------------------------------------------ randomness
let seed = 2187
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const int = (a, b) => a + Math.floor(rand() * (b - a + 1))
const pick = (xs) => xs[Math.floor(rand() * xs.length)]
const chance = (p) => rand() < p
const shuffle = (xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const sample = (xs, n) => shuffle(xs).slice(0, Math.max(0, Math.min(n, xs.length)))
const weighted = (xs, ws) => { let r = rand() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < xs.length; i++) { r -= ws[i]; if (r <= 0) return xs[i] } return xs[xs.length - 1] }
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// ---------------------------------------------------------------- themes
// Twelve themes. Each drives a folder mix, tags, shared concepts and five
// Graphify communities of uneven size (sixty in all).
const THEMES = [
  { id: 'fold', name: 'Fold-Space Physics', tags: ['tech/propulsion', 'physics/fold-space', 'hazard/radiation'],
    concepts: ['resonance drift', 'fold wake', 'tachyon shear', 'phase anchoring', 'the Adeyemi limit', 'fold harmonics', 'null corridor', 'exotic matter ballast', 'jump echo', 'spacetime lensing', 'drive bloom', 'causality buffer', 'fold scarring', 'harmonic lock', 'the quiet jump'],
    communities: ['Fold-Space Physics', 'Drive Safety', 'Resonance Theory', 'Jump Navigation', 'Exotic Matter'],
    words: ['the fold drive hummed at the edge of tolerance', 'space folded like wet paper', 'the resonance needle climbed past amber', 'every jump left a faint scar in the charts'] },
  { id: 'oru', name: 'Xenobiology of Oru', tags: ['biome/ocean/abyssal', 'xenobiology', 'biome/ocean/reef'],
    concepts: ['spore-song', 'bioluminescent grammar', 'the glass tide', 'abyssal chorus', 'tidal symbiosis', 'lantern chemistry', 'reef memory', 'pressure bloom', 'silica shells', 'the drowning light', 'brine cathedrals', 'current-walking', 'the pale migration', 'hydrothermal gardens', 'shoal mind'],
    communities: ['Oru Ocean Life', 'Abyssal Ecology', 'Bioluminescence', 'Tidal Symbiosis', 'Reef Memory'],
    words: ['the water glowed a patient blue', 'something below the shelf answered in light', 'the tide came in as glass and went out as song', 'samples sang faintly in their jars'] },
  { id: 'contact', name: 'First Contact Protocols', tags: ['contact', 'protocol/first-contact', 'ethics'],
    concepts: ['the silent greeting', 'mirror protocol', 'intent signalling', 'contact quarantine', 'the non-interference line', 'shared-zero mathematics', 'translation lattice', 'gesture grammar', 'the first question', 'signal humility', 'reciprocal pause', 'cultural firewall', 'the welcome paradox', 'observer drift', 'consent beacons'],
    communities: ['First Contact Protocols', 'Translation Science', 'Contact Ethics', 'Signal Etiquette', 'Cultural Firewalls'],
    words: ['nobody spoke first, by design', 'the protocol said wait, and they waited', 'a single prime number blinked back', 'the room held its breath for eleven minutes'] },
  { id: 'hydro', name: 'Hydroponics & Survival', tags: ['survival', 'hydroponics', 'supply/food'],
    concepts: ['the green deck', 'nutrient cascade', 'algae ration', 'closed-loop water', 'seed vault', 'root rot crisis', 'light starvation', 'the long harvest', 'mycelium bricks', 'oxygen garden', 'rationing ladder', 'the salt blight', 'compost engine', 'emergency sprouting', 'the last tomato'],
    communities: ['Hydroponics & Survival', 'Food Security', 'Closed-Loop Life Support', 'Seed Preservation', 'Rationing'],
    words: ['the green deck smelled of rain that never fell', 'every leaf was counted twice', 'the harvest came in thin but alive', 'water was the only currency that mattered'] },
  { id: 'orrery', name: 'Ship Systems & ORRERY', tags: ['ship/systems', 'ai/orrery', 'ship/maintenance'],
    concepts: ['ORRERY', 'the orrery dream', 'core memory lattice', 'the soft override', 'machine patience', 'predictive maintenance', 'the trust ledger', 'hull telemetry', 'the quiet subroutine', 'self-repair cascade', 'command handshake', 'the ninth fallback', 'sensor ghosts', 'empathy module', 'deferred obedience'],
    communities: ['Ship Systems', 'ORRERY Cognition', 'Maintenance Culture', 'Command & Trust', 'Sensor Anomalies'],
    words: ['ORRERY logged the decision and, unusually, its doubt', 'the ship corrected itself before anyone noticed', 'the telemetry told a calmer story than the crew', 'somewhere in the core a subroutine hesitated'] },
  { id: 'carto', name: 'Stellar Cartography', tags: ['navigation', 'cartography', 'navigation/deep-space'],
    concepts: ['the Outer Reach', 'drift charts', 'gravity shoals', 'the dark meridian', 'parallax ladders', 'beacon chains', 'star-fall', 'uncharted silence', 'the cartographer’s error', 'lensed horizons', 'waypoint decay', 'the long survey', 'dust rivers', 'orbital census', 'the edge of the map'],
    communities: ['Stellar Cartography', 'Deep-Space Navigation', 'Beacon Networks', 'Gravity Hazards', 'Survey Methods'],
    words: ['the charts ended and the dark began', 'three beacons flickered where there should have been four', 'the survey drone came back with more questions', 'the map was redrawn for the ninth time'] },
  { id: 'silent', name: 'The Silent Cluster', tags: ['anomaly', 'anomaly/silent-cluster', 'hazard/unknown'],
    concepts: ['the silence', 'signal absence', 'the listening stones', 'null choir', 'the missing hour', 'dead-air geometry', 'the quiet wound', 'echo famine', 'the stillwater effect', 'unspoken orbit'],
    communities: ['The Silent Cluster', 'Signal Absence', 'The Missing Hour', 'Listening Stones', 'Stillwater Effect'],
    words: ['no signal came back, not even static', 'the instruments reported nothing, perfectly', 'the crew spoke in whispers without deciding to', 'an hour was missing from every clock aboard'] },
  { id: 'crew', name: 'Crew Life & Morale', tags: ['crew', 'morale', 'crew/ritual'],
    concepts: ['the midwatch supper', 'shore-leave lottery', 'long-haul fatigue', 'the letter archive', 'deck-four choir', 'birthday protocol', 'grief rotation', 'the observation lounge', 'homesick hour', 'the chess ladder', 'watch rotation', 'the memory wall', 'quiet quarters', 'the captain’s table', 'first-snow tradition'],
    communities: ['Crew Life & Morale', 'Rituals Aboard', 'Long-Haul Wellbeing', 'Grief & Memory', 'Recreation'],
    words: ['someone had strung lights along the corridor again', 'the midwatch supper ran long and nobody minded', 'laughter carried further than it should in the low gravity', 'letters from home were read aloud, twice'] },
  { id: 'ruins', name: 'Precursor Ruins', tags: ['archaeology', 'precursors', 'archaeology/ruins'],
    concepts: ['the Precursors', 'spiral glyphs', 'the sealed vault', 'harmonic masonry', 'the lantern script', 'buried observatories', 'the patient architecture', 'star-map murals', 'resonant doors', 'the absent builders', 'ossuary gardens', 'the third inscription', 'chronolith', 'the drowned library', 'keystone engines'],
    communities: ['Precursor Ruins', 'Glyph Decipherment', 'Ancient Engineering', 'The Drowned Library', 'Star-Map Murals'],
    words: ['the doorway opened at a hum only the ship could make', 'the glyphs were older than the star that lit them', 'every chamber faced the same distant point', 'the builders had left, carefully, on purpose'] },
  { id: 'med', name: 'Medicine & Quarantine', tags: ['medicine', 'quarantine', 'hazard/biological'],
    concepts: ['the blue fever', 'spore quarantine', 'cryo triage', 'the immunity map', 'xeno-allergens', 'field surgery', 'the sickbay ledger', 'decontamination arch', 'long-sleep recovery', 'the Halvorsen serum', 'contagion modelling', 'bone-density drift', 'the isolation ward', 'radiation burn protocol', 'phantom symptoms'],
    communities: ['Medicine & Quarantine', 'Xeno-Pathology', 'Cryo Medicine', 'Contagion Control', 'Field Surgery'],
    words: ['sickbay went quiet in the way that frightened everyone', 'the serum held, barely', 'quarantine doors sealed with a sound like a verdict', 'the fever broke on the ninth day'] },
  { id: 'vell', name: 'Diplomacy with the Vell', tags: ['diplomacy', 'species/vell', 'contact/vell'],
    concepts: ['the Vell', 'drift-speech', 'the gift exchange', 'Vell honour debts', 'the slow treaty', 'wind-reading', 'the drifter council', 'hospitality rites', 'trade in silence', 'the broken promise', 'Vell migration law', 'the listening embassy', 'shared-sky accord', 'kinship by weather', 'the returned gift'],
    communities: ['Diplomacy with the Vell', 'Vell Culture', 'The Slow Treaty', 'Honour & Debt', 'Trade Relations'],
    words: ['the Vell spoke only when the wind agreed', 'the treaty was written in weather, not ink', 'a gift was returned, which meant everything', 'the council drifted apart and together like cloud'] },
  { id: 'salvage', name: 'Salvage & Engineering', tags: ['engineering', 'salvage', 'ship/hull'],
    concepts: ['hull mending', 'the scrap economy', 'derelict etiquette', 'improvised shielding', 'the spare-parts ledger', 'zero-g welding', 'the cannibal refit', 'structural fatigue', 'the lucky bolt', 'field fabrication', 'reactor patchwork', 'salvage rights', 'the junkyard fleet', 'stress fractures', 'the engineer’s oath'],
    communities: ['Salvage & Engineering', 'Hull Repair', 'Derelict Salvage', 'Field Fabrication', 'Reactor Patchwork'],
    words: ['the hull held because someone refused to let it fail', 'they built what they needed out of what they found', 'the derelict gave up its parts without complaint', 'three welds and a prayer kept the reactor honest'] },
]
const themeById = Object.fromEntries(THEMES.map((t) => [t.id, t]))

// ---------------------------------------------------------------- names
const SYL = ['or', 'ves', 'ka', 'lim', 'teth', 'ra', 'zor', 'an', 'mel', 'qu', 'ith', 'dar', 'ny', 'sel', 'ov', 'ae', 'kir', 'thal', 'ush', 'ven', 'mor', 'eli', 'pa', 'xan', 'ul', 'ris', 'bo', 'har', 'ci', 'dun']
const proper = () => cap(Array.from({ length: int(2, 3) }, () => pick(SYL)).join(''))
const ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'IX', 'XI']
const WORLD_THING = ['Lantern', 'Anvil', 'Cradle', 'Crown', 'Veil', 'Harbour', 'Needle', 'Hearth', 'Loom', 'Mirror', 'Bell', 'Orchard']
const WORLD_PLACE = ['Tides', 'Reach', 'Shelf', 'Deeps', 'Spires', 'Wastes', 'Gardens', 'Belt', 'Shallows', 'Steppes', 'Vaults', 'Fields']
const ADJ = ['Glass', 'Drowned', 'Silent', 'Ember', 'Hollow', 'Iron', 'Singing', 'Pale', 'Burning', 'Frozen', 'Amber', 'Broken', 'Hungry', 'Sleeping', 'Crimson', 'Velvet']
const ORGANISM = ['Moss', 'Drifters', 'Eels', 'Weavers', 'Choir', 'Shoals', 'Wardens', 'Bloom', 'Mites', 'Leviathans', 'Grazers', 'Swarm', 'Lanterns', 'Crawlers', 'Kelp', 'Rays']
const TECH_MOD = ['fold', 'graviton', 'memory', 'lattice', 'spore', 'echo', 'cryo', 'quantum', 'hull', 'star', 'phase', 'ion', 'tidal', 'silent', 'neural', 'plasma']
const TECH_DEV = ['drive', 'loom', 'crystal', 'shield', 'scrubber', 'lance', 'cradle', 'abacus', 'mender', 'compass', 'anchor', 'sail', 'lens', 'furnace', 'beacon', 'harp']
const FIRST = ['Ines', 'Tomas', 'Amara', 'Kenji', 'Sofia', 'Idris', 'Mei', 'Oskar', 'Leilani', 'Ravi', 'Freya', 'Mateo', 'Yara', 'Dmitri', 'Noor', 'Emeka', 'Hana', 'Luca', 'Zainab', 'Arjun', 'Signe', 'Kofi', 'Elif', 'Rafael', 'Tallulah', 'Bao', 'Ingrid', 'Samir', 'Wren', 'Aurelio']
const LAST = ['Vantablack', 'Adeyemi', 'Halvorsen', 'Okonkwo', 'Moreau', 'Takeda', 'Castellanos', 'Lindqvist', 'Nakamura', 'Oyelaran', 'Petrakis', 'Quill', 'Rasmussen', 'Solberg', 'Tanaka', 'Umarov', 'Valdés', 'Whitlock', 'Yilmaz', 'Zhao', 'Achterberg', 'Brightwater', 'Carrow', 'Delacroix', 'Ekwueme']
const RANK = ['Captain', 'Commander', 'Lieutenant', 'Dr.', 'Chief', 'Ensign', 'Specialist', 'Navigator']
const ROLE = ['xenobiologist', 'fold engineer', 'navigator', 'ship’s surgeon', 'hydroponics chief', 'linguist', 'salvage lead', 'systems officer', 'archaeologist', 'quartermaster', 'pilot', 'diplomatic envoy', 'medic', 'cartographer']
const MISSION_WORD = ['Tidebreaker', 'Lanternfall', 'Quiet Harbour', 'Glasswing', 'Long Echo', 'Emberline', 'Hollow Crown', 'Starwell', 'Paleglass', 'Driftwood', 'Keystone', 'Ninth Bell', 'Low Tide', 'Whisperfield', 'Ironveil', 'Seedvault']
const EVENT = ['the Hull Breach at Deck Seven', 'the Choir Moss Bloom', 'the Missing Hour', 'the Fold Stall', 'the Salt Blight', 'the Vell Gift', 'the Glass Tide Surge', 'the Sensor Ghosts', 'the Quarantine Vote', 'the Midwatch Fire', 'the Lantern Signal', 'the Reactor Hiccup', 'the Drift Storm', 'the Silent Landing', 'the Archive Flood', 'the Long Dark']
const STATUSES = ['succeeded', 'succeeded', 'succeeded', 'failed', 'active', 'planned', 'lost']

const usedTitles = new Set()
const unique = (make) => { for (let i = 0; i < 200; i++) { const t = make(); if (!usedTitles.has(t.toLowerCase())) { usedTitles.add(t.toLowerCase()); return t } } throw new Error('ran out of names') }
const themeWeights = THEMES.map((t) => (t.id === 'silent' ? 0 : 1))
const anyTheme = () => weighted(THEMES, themeWeights)

// ----------------------------------------------------------------- notes
/** @typedef {{ folder: string, title: string, theme: string, file: string, links: Set<string>, leaf?: boolean, island?: boolean, chain?: boolean, orphan?: boolean, fm: Record<string,any>, concepts: {label:string, community:string, kind:string, unique:boolean}[], body?: string }} Note */
/** @type {Note[]} */
const notes = []
const add = (folder, title, theme, fm = {}) => {
  const n = { folder, title, theme, file: `${folder ? folder + '/' : ''}${slug(title)}.md`, links: new Set(), fm, concepts: [] }
  notes.push(n)
  return n
}
const THEME_FOLDERS = {
  worlds: ['oru', 'carto', 'ruins', 'fold', 'vell', 'contact'],
  species: ['oru', 'vell', 'med', 'contact', 'hydro'],
  tech: ['fold', 'orrery', 'salvage', 'hydro', 'med', 'carto'],
  crew: ['crew', 'orrery', 'med', 'salvage', 'contact', 'fold', 'oru'],
  missions: ['carto', 'contact', 'ruins', 'oru', 'salvage', 'vell', 'med'],
  logs: ['crew', 'orrery', 'fold', 'med', 'hydro', 'salvage', 'vell'],
}
const themeFor = (folder) => pick(THEME_FOLDERS[folder])

const worlds = Array.from({ length: 110 }, () => {
  const title = unique(() => pick([
    () => `${proper()}'s ${pick(WORLD_THING)}`,
    () => `The ${pick(ADJ)} ${pick(WORLD_PLACE)} of ${proper()}`,
    () => `${proper()} ${pick(ROMAN)}`,
    () => `${proper()} Station`,
    () => `${pick(ADJ)} ${pick(WORLD_PLACE)}`,
  ])())
  return add('worlds', title, themeFor('worlds'), { type: 'world', sector: pick(['Outer Reach', 'Oru Deep', 'Vell Drift', 'Lantern Belt', 'Meridian Line']) })
})
// The glass tides of Oru and Kepler's Lantern are the archive's landmarks.
worlds[0].title = "Kepler's Lantern"; worlds[0].file = 'worlds/keplers-lantern.md'; worlds[0].theme = 'carto'
worlds[1].title = 'The Glass Tides of Oru'; worlds[1].file = 'worlds/the-glass-tides-of-oru.md'; worlds[1].theme = 'oru'
const species = Array.from({ length: 90 }, () => add('species', unique(() => `${pick([...ADJ, proper(), proper()])} ${pick(ORGANISM)}`), themeFor('species'), { type: 'species' }))
species[0].title = 'Choir Moss'; species[0].file = 'species/choir-moss.md'; species[0].theme = 'oru'
species[1].title = 'Vell Drifters'; species[1].file = 'species/vell-drifters.md'; species[1].theme = 'vell'
const tech = Array.from({ length: 120 }, () => add('tech', unique(() => cap(`${pick(TECH_MOD)} ${pick(TECH_DEV)}`)), themeFor('tech'), { type: 'technology' }))
const crew = Array.from({ length: 69 }, () => {
  const title = unique(() => `${pick(RANK)} ${pick(FIRST)} ${pick(LAST)}`)
  return add('crew', title, themeFor('crew'), { type: 'crew', role: pick(ROLE) })
})
crew[0].title = 'Captain Ines Vantablack'; crew[0].file = 'crew/captain-ines-vantablack.md'; crew[0].theme = 'crew'; crew[0].fm.role = 'commanding officer'
const orrery = add('crew', 'ORRERY', 'orrery', { type: 'crew', role: 'ship intelligence' })
const missions = Array.from({ length: 140 }, () => {
  const w = pick(worlds)
  const title = unique(() => pick([
    () => `Operation ${pick(MISSION_WORD)}`,
    () => `Survey of ${pick(worlds).title.replace(/^The /, '')}`,
    () => `Rescue at ${pick(worlds).title.replace(/^The /, '')}`,
    () => `${pick(worlds).title.replace(/^The /, '')} Quarantine`,
    () => `Operation ${pick(MISSION_WORD)} ${pick(ROMAN)}`,
  ])())
  return add('missions', title, themeFor('missions'), { type: 'mission', status: pick(STATUSES), year: int(2187, 2194), world: w.title })
})
const logs = Array.from({ length: 74 }, () => {
  const year = int(2187, 2194)
  const title = unique(() => pick([
    () => `Captain's Log ${year}.${String(int(1, 365)).padStart(3, '0')} — ${cap(pick(EVENT).replace(/^the /, ''))}`,
    () => `Incident Report: ${cap(pick(EVENT).replace(/^the /, ''))} (${year})`,
    () => `Watch Log ${year}.${String(int(1, 365)).padStart(3, '0')}`,
  ])())
  return add('logs', title, themeFor('logs'), { type: 'log', year })
})
// A long chain: "The Long Silence", eight parts, each pointing at the next.
const chain = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map((r) => add('logs', `The Long Silence, Part ${r}`, 'crew', { type: 'log', year: 2193 }))
chain.forEach((n, i) => { n.chain = true; if (chain[i + 1]) n.links.add(chain[i + 1].file) })
// An island: the Silent Cluster, twelve notes that only know each other.
const island = [
  add('worlds', 'The Silent Cluster', 'silent', { type: 'world', sector: 'Silent Cluster' }),
  ...Array.from({ length: 5 }, (_, i) => add('worlds', `Stillwater ${['Prime', 'Minor', 'Deep', 'Ring', 'Verge'][i]}`, 'silent', { type: 'world', sector: 'Silent Cluster' })),
  add('species', 'Listening Stones', 'silent', { type: 'species' }),
  add('species', 'Null Choir', 'silent', { type: 'species' }),
  add('logs', 'Watch Log 2192.001 — The Missing Hour', 'silent', { type: 'log', year: 2192 }),
  add('logs', 'Incident Report: Dead Air (2192)', 'silent', { type: 'log', year: 2192 }),
  add('missions', 'Survey of the Silent Cluster', 'silent', { type: 'mission', status: 'lost', year: 2192 }),
  add('missions', 'Operation Whisperfield Recovery', 'silent', { type: 'mission', status: 'failed', year: 2193 }),
]
island.forEach((n) => { n.island = true; for (const m of sample(island.filter((x) => x !== n), 3)) n.links.add(m.file) })
// Unfiled fragments at the root: no links in or out.
const orphans = Array.from({ length: 25 }, (_, i) => {
  const n = add('', `Unfiled Fragment ${String(i + 1).padStart(3, '0')}`, anyTheme().id, { type: 'fragment' })
  n.orphan = true
  return n
})

// Topic maps: the hubs. Each gathers 40-120 notes of its themes.
const MAPS = [
  ['Atlas of the Outer Reach', ['carto']], ['Index of First Contacts', ['contact', 'vell']], ['Bestiary of Oru', ['oru']],
  ['The Fold Engineer’s Handbook', ['fold']], ['Crew Manifest', ['crew']], ['Ledger of the Green Deck', ['hydro']],
  ['ORRERY Core Index', ['orrery']], ['Catalogue of Precursor Sites', ['ruins']], ['Sickbay Casebook', ['med']],
  ['The Vell Accords', ['vell']], ['Salvage Registry', ['salvage']], ['Mission Board 2187–2190', ['carto', 'contact', 'oru']],
  ['Mission Board 2191–2194', ['ruins', 'salvage', 'med', 'vell']], ['Captain’s Collected Logs', ['crew', 'orrery']],
  ['Hazard Register', ['fold', 'med']], ['Technology Almanac', ['salvage', 'orrery', 'hydro']], ['Survey Methods Primer', ['carto', 'ruins']],
  ['Field Guide to the Deeps', ['oru', 'hydro']],
].map(([title, themes]) => { const n = add('maps', title, themes[0], { type: 'map' }); n.mapThemes = themes; return n })

// ------------------------------------------------------------ the links
const regular = notes.filter((n) => !n.island && !n.chain && !n.orphan && n.folder !== 'maps')
// One in five regular notes hangs off a single map and nothing else: Hubs mode shows these as rings.
const LANDMARKS = ['keplers-lantern', 'the-glass-tides-of-oru', 'choir-moss', 'vell-drifters', 'captain-ines-vantablack']
for (const n of regular) if (chance(0.2) && n !== orrery && !LANDMARKS.some((s) => n.file.endsWith(s + '.md'))) n.leaf = true
const linkable = regular.filter((n) => !n.leaf)
const byTheme = {}
for (const n of linkable) (byTheme[n.theme] ||= []).push(n)
for (const n of linkable) {
  const k = int(2, 7)
  for (let i = 0; i < k; i++) {
    const pool = chance(0.75) ? byTheme[n.theme] : linkable
    const m = pick(pool)
    if (m !== n) n.links.add(m.file)
  }
  if (chance(0.25)) n.links.add(orrery.file)
  if (n.folder === 'missions' && chance(0.6)) n.links.add(pick(crew.filter((c) => !c.leaf)).file)
}
// The first log of the chain is reachable from the captain.
crew[0].links.add(chain[0].file)
for (const map of MAPS) {
  const pool = regular.filter((n) => map.mapThemes.includes(n.theme))
  const members = sample(pool, int(40, Math.min(120, pool.length)))
  for (const m of members) map.links.add(m.file)
}
// Every leaf belongs to exactly one map.
for (const n of regular.filter((x) => x.leaf)) {
  const home = MAPS.find((m) => m.mapThemes.includes(n.theme)) || pick(MAPS)
  for (const map of MAPS) map.links.delete(n.file)
  home.links.add(n.file)
}

// ----------------------------------------------------------------- tags
const EXTRA_TAGS = ['status/archived', 'priority/high', 'priority/low', 'needs-review', 'classified', 'verified', 'rumour', 'eyewitness', 'lore', 'timeline', 'field-notes', 'quote']
const folderTag = { worlds: 'world', species: 'species', tech: 'technology', crew: 'crew', missions: 'mission', logs: 'log', maps: 'map', '': 'fragment' }
for (const n of notes) {
  const t = themeById[n.theme]
  n.fm.tags = [...new Set([folderTag[n.folder], ...sample(t.tags, int(1, 2)), ...(chance(0.35) ? [pick(EXTRA_TAGS)] : [])])]
  if (n.folder === 'missions') n.fm.tags.push(`mission/${n.fm.status}`)
}

// ------------------------------------------------------------- concepts
// Graphify finds ideas inside each note. Most are the note's own (they hang off
// it as leaves), some are the theme's shared concepts (they bridge notes).
const ASPECT = {
  worlds: ['{s} orbital resonance', '{s} storm cycle', 'the {s} beacon', '{s} ice shelf', '{s} landing site', '{s} tidal lock', '{s} magnetosphere', 'the {s} rift'],
  species: ['{s} song', '{s} life cycle', '{s} symbiosis', '{s} migration', '{s} nesting grounds', '{s} venom', '{s} courtship lights'],
  tech: ['{s} calibration', '{s} failure mode', '{s} prototype', '{s} field test', '{s} power draw', '{s} safety interlock'],
  crew: ['{s}’s command style', '{s}’s field journal', '{s}’s research', '{s}’s last posting', '{s}’s commendation'],
  missions: ['{s} landing party', '{s} objective', '{s} debrief', '{s} supply manifest', '{s} casualty report'],
  logs: ['the {s} alarm', '{s} timeline', '{s} witness account', '{s} aftermath'],
  maps: [], '': ['{s} torn page', '{s} margin note'],
}
const shortName = (n) => {
  const t = n.title.replace(/^(The |Operation |Survey of |Rescue at |Captain's Log [\d.]+ — |Incident Report: |Watch Log [\d.]+( — )?|Captain |Commander |Lieutenant |Dr\. |Chief |Ensign |Specialist |Navigator )/, '')
  return t.replace(/ \(\d{4}\)$/, '').replace(/ Quarantine$/, '').split(',')[0] || n.title
}
const communityFor = (theme) => weighted(themeById[theme].communities, [0.4, 0.25, 0.15, 0.12, 0.08])
for (const n of notes) {
  const s = shortName(n)
  const own = sample(ASPECT[n.folder] || [], n.folder === 'maps' ? 0 : int(2, 4)).map((a) => ({ label: a.replace('{s}', s), unique: true }))
  const shared = sample(themeById[n.theme].concepts, n.folder === 'maps' ? 5 : int(1, 3)).map((label) => ({ label, unique: false }))
  n.community = communityFor(n.theme)
  n.concepts = [...own.map((c) => ({ ...c, community: n.community, kind: 'concept' })), ...shared.map((c) => ({ ...c, community: '', kind: 'concept' }))]
}

// ---------------------------------------------------------------- papers
const PAPER_TOPIC = { fold: ['Fold-Space Resonance', 'Tachyon Shear in Crewed Jumps', 'The Adeyemi Limit Revisited'], oru: ['Bioluminescent Grammar in the Oru Deeps', 'Spore-Song as Signal', 'Silica Shells and Tidal Memory'], contact: ['The Mirror Protocol', 'Shared-Zero Mathematics', 'On Signal Humility'], hydro: ['Closed-Loop Water at Scale', 'The Salt Blight Post-Mortem', 'Mycelium as Building Material'], orrery: ['Deferred Obedience in Ship Intelligences', 'The Trust Ledger', 'Sensor Ghosts: A Taxonomy'], carto: ['Gravity Shoals of the Outer Reach', 'Beacon Chain Decay', 'Parallax Ladders for Deep Survey'], silent: ['On the Absence of Signal'], crew: ['Long-Haul Fatigue and Ritual', 'Grief Rotation Aboard Survey Ships'], ruins: ['Harmonic Masonry of the Precursors', 'Toward Reading the Lantern Script', 'The Drowned Library Hypothesis'], med: ['The Blue Fever Outbreak', 'Cryo Triage Outcomes', 'Xeno-Allergen Screening'], vell: ['Drift-Speech Phonology', 'Honour Debts and the Slow Treaty', 'Kinship by Weather'], salvage: ['Structural Fatigue in Refitted Hulls', 'The Scrap Economy', 'Zero-G Welding Tolerances'] }
const papers = []
for (const t of THEMES) for (const topic of PAPER_TOPIC[t.id]) {
  for (const variant of ['On ', 'Notes on ', ''].slice(0, t.id === 'silent' ? 1 : 3)) {
    if (papers.length >= 80) break
    const title = `${variant}${topic}`.replace(/^On On /, 'On ')
    if (papers.some((p) => p.label === title)) continue
    papers.push({ label: title, theme: t.id, author: `${pick(LAST)}`, year: int(2180, 2193) })
  }
}
for (const n of notes) {
  if (n.orphan || n.folder === 'maps') continue
  const pool = papers.filter((p) => p.theme === n.theme)
  n.cites = pool.length && chance(0.45) ? sample(pool, int(1, 2)) : []
}

// ------------------------------------------------------------ rationales
const RATIONALE_Q = ['Why the {c} must idle before a jump', 'Why the {c} is never run unattended', 'Why the {c} was retired', 'Why the {c} protocol waits eleven minutes', 'Why the {c} crew rotates every watch', 'Why the {c} is kept behind two doors']
const rationales = []
for (const n of sample(notes.filter((x) => ['tech', 'missions', 'logs'].includes(x.folder) && !x.orphan), 150)) {
  const c = shortName(n).toLowerCase()
  const label = pick(RATIONALE_Q).replace('{c}', c)
  rationales.push({ label, note: n, theme: n.theme, reason: `${cap(pick(themeById[n.theme].words))}; the crew learned this the hard way, and wrote it down so the next crew would not have to.` })
  n.rationales = [...(n.rationales || []), rationales[rationales.length - 1]]
}

// ------------------------------------------------------------ note text
const link = (file) => { const m = notes.find((x) => x.file === file); return `[[${file.replace(/\.md$/, '').split('/').pop()}|${m.title}]]` }
const OPEN = {
  worlds: ['{t} sits {where}, and the first survey team called it {mood}.', 'Charts list {t} as a {kind} world {where}.', 'Nobody forgets their first approach to {t}.'],
  species: ['The {t} were first recorded by a survey drone, then by very nervous people.', '{t} are {mood} to watch and harder to classify.', 'The archive keeps more questions than answers about the {t}.'],
  tech: ['The {t} is the kind of machine that works perfectly until it becomes a story.', 'Every engineer aboard has an opinion about the {t}.', 'The {t} was fitted during the second refit and never fully trusted.'],
  crew: ['{t} kept the ship honest, according to most of the crew.', 'The archive remembers {t} for more than the service record says.', '{t} joined the Meridian in the second year and never quite left.'],
  missions: ['{t} was logged as {status} in {year}.', 'The board marked {t} {status} in {year}, which only tells half of it.', '{t} began, like most missions, with a bad map and good intentions.'],
  logs: ['This entry was written in a hurry.', 'The following is transcribed from the ship’s voice recorder.', 'Recorded during the midwatch; some words are lost to static.'],
  maps: ['This page gathers everything the archive holds on its subject.', 'An index, kept by ORRERY and corrected by hand.'],
  '': ['A scrap of the archive, recovered without a folder or a date.'],
}
const WHERE = ['at the edge of the Outer Reach', 'deep in the Oru system', 'along the Vell Drift', 'inside the Lantern Belt', 'just off the Meridian Line']
const MOOD = ['beautiful', 'unsettling', 'patient', 'loud', 'lonely', 'impossible', 'generous']
const CONCEPT_SENT = [
  '{c} came up in every debrief afterwards.', 'The notes on {c} run to several pages.', 'Nobody agreed on what {c} really meant.',
  'The crew learned about {c} the hard way.', 'ORRERY flagged {c} before anyone else noticed it.', '{c} is still an open question in the archive.',
  'Most of the arguments aboard came back to {c}.', 'The survey team spent a week on {c} alone.',
]
const MENTION = [
  'See also {l}.', 'This connects to {l} in ways that are still being argued over.', 'Compare the account in {l}.',
  'The same pattern showed up at {l}.', '{l} tells the other side of the story.', 'Crew who worked on {l} disagreed.',
]
for (const n of notes) {
  const t = themeById[n.theme]
  const parts = []
  // A title reads "the Glass Tides of Oru" in the middle of a sentence.
  const mid = n.title.replace(/^The /, 'the ')
  const fill = (s) => s.replace(/^\{t\}/, n.title).replace('{t}', mid).replace('{where}', pick(WHERE)).replace('{mood}', pick(MOOD)).replace('{kind}', pick(['tidal', 'frozen', 'storm', 'garden', 'ruin', 'ocean', 'desert']))
    .replace('{status}', n.fm.status || 'unknown').replace('{year}', String(n.fm.year || 2190))
  parts.push(`# ${n.title}\n`)
  const [w1, w2] = sample(t.words, 2)
  parts.push(`${fill(pick(OPEN[n.folder]))} ${cap(w1)}. ${cap(w2)}, and ${pick(t.concepts)} was never far from anyone's mind.`)
  // Every idea Graphify will find in this note appears in its text, so a click can highlight it.
  const csent = n.concepts.map((c) => { const tpl = pick(CONCEPT_SENT); return tpl.replace('{c}', tpl.startsWith('{c}') ? cap(c.label) : c.label) })
  if (csent.length) parts.push(csent.join(' '))
  if (n.folder === 'maps') {
    const bySection = {}
    for (const f of n.links) { const m = notes.find((x) => x.file === f); (bySection[m.folder] ||= []).push(f) }
    for (const [folder, files] of Object.entries(bySection)) parts.push(`## ${cap(folder)}\n\n${files.map((f) => `- ${link(f)}`).join('\n')}`)
  } else {
    const links = [...n.links]
    if (links.length) parts.push(links.map((f) => pick(MENTION).replace('{l}', link(f))).join(' '))
    if (n.chain) parts.push(`${cap(pick(themeById.crew.words))}. The silence outside the hull had started to feel like a presence.`)
    for (const r of n.rationales || []) parts.push(`**${r.label}.** ${r.reason}`)
    for (const p of n.cites || []) parts.push(`Further reading: *${p.label}* (${p.author}, ${p.year}).`)
    const [a, b] = sample(t.words, 2)
    parts.push(`${cap(a)}. ${cap(b)}.`)
  }
  const fm = { title: n.title, ...n.fm }
  const yaml = Object.entries(fm).map(([k, v]) => Array.isArray(v) ? `${k}: [${v.join(', ')}]` : `${k}: ${typeof v === 'string' && /[:#'"]/.test(v) ? JSON.stringify(v) : v}`).join('\n')
  n.body = `---\n${yaml}\n---\n\n${parts.join('\n\n')}\n`
}

// --------------------------------------------------------- graphify graph
// Graphify's output format: networkx node-link JSON, as graphify-out/graph.json.
const gid = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const communities = THEMES.flatMap((t) => t.communities)
const communityId = new Map(communities.map((c, i) => [c, i]))
const gNodes = []
const gLinks = []
const nodeById = new Map()
const gnode = (id, label, fileType, sourceFile, community, extra = {}) => {
  if (nodeById.has(id)) return nodeById.get(id)
  const node = { label, file_type: fileType, source_file: sourceFile, source_location: null, source_url: null, captured_at: null, author: null, contributor: null, community: communityId.get(community), norm_label: label.toLowerCase(), id, community_name: community, ...extra }
  nodeById.set(id, node)
  gNodes.push(node)
  return node
}
const glink = (source, target, relation, confidence = 'EXTRACTED', sourceFile = null) => {
  if (source === target) return
  gLinks.push({ relation, confidence, confidence_score: confidence === 'EXTRACTED' ? 1.0 : confidence === 'INFERRED' ? Number((0.55 + rand() * 0.35).toFixed(2)) : 0.4, source_file: sourceFile, source_location: null, weight: 1.0, source, target })
}
const docId = (n) => `${gid(n.file.replace(/\.md$/, ''))}_article`
const sharedConcept = new Map()
for (const n of notes) {
  const d = gnode(docId(n), n.title, 'document', n.file, n.community)
  for (const c of n.concepts) {
    if (c.unique) {
      const cn = gnode(`${gid(n.file.replace(/\.md$/, ''))}_${gid(c.label)}`, cap(c.label), 'concept', n.file, n.community)
      glink(d.id, cn.id, 'references', 'EXTRACTED', n.file)
    } else {
      let cn = sharedConcept.get(c.label)
      if (!cn) { cn = gnode(`concept_${gid(c.label)}`, cap(c.label), 'concept', n.file, communityFor(n.theme)); sharedConcept.set(c.label, cn) }
      glink(d.id, cn.id, 'references', 'EXTRACTED', n.file)
    }
  }
}
// Shared concepts relate to each other within their theme, and Graphify infers some links across themes.
for (const t of THEMES) {
  const cs = t.concepts.map((c) => sharedConcept.get(c)).filter(Boolean)
  for (const a of cs) for (const b of sample(cs, int(1, 3))) if (a !== b) glink(a.id, b.id, 'conceptually_related_to', chance(0.8) ? 'EXTRACTED' : 'INFERRED', a.source_file)
}
const allShared = [...sharedConcept.values()]
for (let i = 0; i < 360; i++) glink(pick(allShared).id, pick(allShared).id, 'semantically_similar_to', chance(0.94) ? 'INFERRED' : 'AMBIGUOUS')
// Some of each note's own ideas turn out to implement or touch a shared one.
for (const n of notes) {
  const own = gNodes.filter((x) => x.source_file === n.file && x.file_type === 'concept' && !x.id.startsWith('concept_'))
  const themeShared = themeById[n.theme].concepts.map((c) => sharedConcept.get(c)).filter(Boolean)
  for (const c of own) {
    if (!chance(0.22)) continue
    const target = themeShared.length ? pick(themeShared) : pick(allShared)
    glink(c.id, target.id, n.folder === 'tech' ? 'implements' : 'conceptually_related_to', chance(0.55) ? 'INFERRED' : 'EXTRACTED', n.file)
  }
}
// Papers, cited by the notes that name them.
const paperNode = new Map()
for (const n of notes) for (const p of n.cites || []) {
  let pn = paperNode.get(p.label)
  if (!pn) { pn = gnode(`paper_${gid(p.label)}`, p.label, 'paper', n.file, communityFor(p.theme), { author: p.author }); paperNode.set(p.label, pn) }
  glink(docId(n), pn.id, 'cites', 'EXTRACTED', n.file)
}
// Rationales: the reasons notes give, for the ideas they explain.
for (const r of rationales) {
  const rn = gnode(`${gid(r.note.file.replace(/\.md$/, ''))}_${gid(r.label)}`, r.label, 'rationale', r.note.file, r.note.community, { rationale: r.reason })
  glink(docId(r.note), rn.id, 'references', 'EXTRACTED', r.note.file)
  const target = r.note.concepts.find((c) => !c.unique)
  if (target) glink(rn.id, sharedConcept.get(target.label).id, 'rationale_for', 'EXTRACTED', r.note.file)
}
// A share of the notes' own [[links]], which Graphify also records.
for (const n of notes) for (const f of n.links) if (chance(0.3)) glink(docId(n), docId(notes.find((x) => x.file === f)), 'references', 'EXTRACTED', n.file)

// ------------------------------------------------------------------ write
await rm(OUT, { recursive: true, force: true })
for (const n of notes) {
  const p = join(NOTES, n.file)
  await mkdir(dirname(p), { recursive: true })
  await writeFile(p, n.body)
}
await mkdir(join(OUT, 'graphify-out'), { recursive: true })
await writeFile(join(OUT, 'graphify-out', 'graph.json'), JSON.stringify({ directed: false, multigraph: false, graph: {}, nodes: gNodes, links: gLinks, hyperedges: [] }))
const kinds = gNodes.reduce((a, x) => ({ ...a, [x.file_type]: (a[x.file_type] || 0) + 1 }), {})
const inferred = gLinks.filter((l) => l.confidence !== 'EXTRACTED').length
console.log(`${notes.length} notes; graphify: ${gNodes.length} nodes ${JSON.stringify(kinds)}, ${gLinks.length} links (${inferred} inferred), ${new Set(gNodes.map((x) => x.community)).size} communities`)
