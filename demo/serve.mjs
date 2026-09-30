// Serves demo/dist on http://127.0.0.1:8792 (build it first with `npm run demo:build`).
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), 'dist')
const PORT = Number(process.env.PORT || 8792)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url || '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  try {
    const body = await readFile(join(dist, path.endsWith('/') ? path + 'index.html' : path))
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || (path.endsWith('/') ? 'text/html' : 'application/octet-stream'), 'cache-control': 'no-store' })
    res.end(body)
  } catch { res.writeHead(404); res.end('not found') }
}).listen(PORT, '127.0.0.1', () => console.log(`demo on http://127.0.0.1:${PORT}`))
