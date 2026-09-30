#!/usr/bin/env node
// kg-graphify <graphify-out/graph.json> [--notes <notes-folder>] [--strip-prefix wiki/] [--out graphify.json]
// Writes the Graphify graph for the Knowledge Graphs from Graphify's output.
import { writeFile } from 'node:fs/promises'
import { convertGraphifyFile } from './graphify.mjs'

const args = process.argv.slice(2)
if (!args.length || args.includes('--help')) {
  console.log('Usage: kg-graphify <graph.json> [--notes <notes-folder>] [--strip-prefix <prefix>] [--out graphify.json]')
  process.exit(args.length ? 0 : 1)
}
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const graph = await convertGraphifyFile(args[0], opt('--notes'), { stripPrefix: opt('--strip-prefix') })
const json = JSON.stringify(graph)
const out = opt('--out')
if (out) {
  await writeFile(out, json)
  const withNote = graph.nodes.filter((n) => n.note).length
  console.error(`${graph.nodes.length} nodes (${withNote} with a note), ${graph.edges.length} links -> ${out}`)
} else process.stdout.write(json + '\n')
