// Builds the demo site into demo/dist: the page, one script, and the sample data.
import { build } from 'esbuild'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(here, 'dist')
const data = join(root, 'sample-data', 'meridian')
await rm(out, { recursive: true, force: true })
await mkdir(join(out, 'data'), { recursive: true })
await build({ entryPoints: [join(here, 'main.ts')], outfile: join(out, 'app.js'), bundle: true, format: 'esm', minify: true, target: ['es2020'], loader: { '.css': 'text' }, logLevel: 'warning' })
for (const f of ['index.html', 'style.css']) await cp(join(here, f), join(out, f))
for (const f of ['links.json', 'graphify.json', 'semantic.json']) await cp(join(data, f), join(out, 'data', f))
// Every note's Markdown, by id, for the note panel.
const notes = {}
const walk = async (dir) => { for (const e of await readdir(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) await walk(p); else if (e.name.endsWith('.md')) notes[relative(join(data, 'notes'), p).split(sep).join('/')] = await readFile(p, 'utf8') } }
await walk(join(data, 'notes'))
await writeFile(join(out, 'data', 'notes.json'), JSON.stringify(notes))
await writeFile(join(out, '.nojekyll'), '')
console.log(`demo/dist: ${Object.keys(notes).length} notes`)
