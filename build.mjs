// Builds everything the package ships:
//   dist/standalone/{knowledge,force3d,semantic}-graph.js  single files, CSS and
//     libraries inside, each filling a page or web view from KnowledgeGraphConfig
//   dist/index.js, dist/react.js, dist/vue.js  ES modules; three, 3d-force-graph,
//     d3-force, react and vue stay external so the host app shares one copy
//   dist/types/  declarations
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
const banner = '/*! 2D-3D Knowledge Graph Package | (c) Hung Ngo | MIT License | https://github.com/hungnv26/2d-3d-knowledge-graph */'
const common = { bundle: true, loader: { '.css': 'text' }, legalComments: 'none', logLevel: 'warning', banner: { js: banner } }
const report = async (file) => console.log(`${file.replace(here + '/', '').padEnd(40)} ${((await stat(file)).size / 1024).toFixed(0)} KB`)

await rm(dist, { recursive: true, force: true })
await mkdir(join(dist, 'standalone'), { recursive: true })

for (const name of ['knowledge', 'force3d', 'semantic']) {
  const outfile = join(dist, 'standalone', `${name}-graph.js`)
  await build({
    ...common,
    entryPoints: [join(here, 'src', 'standalone', `${name}.ts`)],
    outfile, format: 'iife', target: ['safari16', 'chrome100', 'firefox100'], minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  await report(outfile)
}

const external = ['three', 'three/*', '3d-force-graph', 'd3-force', 'react', 'vue']
// The React and Vue builds import the engine from index.js rather than carry a copy.
const shareEngine = { name: 'share-engine', setup(b) { b.onResolve({ filter: /^\.\.\/wrappers$/ }, () => ({ path: './index.js', external: true })) } }
for (const [entry, out] of [['index.ts', 'index.js'], ['react/index.ts', 'react.js'], ['vue/index.ts', 'vue.js']]) {
  const outfile = join(dist, out)
  await build({ ...common, entryPoints: [join(here, 'src', entry)], outfile, format: 'esm', target: ['es2020'], external, plugins: entry === 'index.ts' ? [] : [shareEngine] })
  await report(outfile)
}

execFileSync(join(here, 'node_modules', '.bin', 'tsc'), [
  '-p', join(here, 'tsconfig.json'), '--noEmit', 'false', '--declaration', '--emitDeclarationOnly', '--outDir', join(dist, 'types'),
], { stdio: 'inherit' })
console.log('dist/types/ written')
