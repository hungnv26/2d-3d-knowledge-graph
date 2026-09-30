#!/usr/bin/env node
// kg-links <notes-folder> [--out links.json] [--exclude <prefix>]...
// Writes the Links graph of a folder of Markdown notes for the Knowledge Graphs.
import { writeFile } from 'node:fs/promises'
import { buildLinksGraph } from './links.mjs'

const args = process.argv.slice(2)
if (!args.length || args.includes('--help')) {
  console.log('Usage: kg-links <notes-folder> [--out links.json] [--exclude <path-prefix>]...')
  process.exit(args.length ? 0 : 1)
}
const root = args[0]
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null
const excludes = args.flatMap((a, i) => (a === '--exclude' ? [args[i + 1]] : []))
const graph = await buildLinksGraph(root, { exclude: (rel) => excludes.some((p) => rel.startsWith(p)) })
const json = JSON.stringify(graph)
if (out) { await writeFile(out, json); console.error(`${graph.nodes.length} notes, ${graph.edges.length} links -> ${out}`) }
else process.stdout.write(json + '\n')
