import { expect, test } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

// The single-file script from dist/standalone, loaded by a plain HTML page with KnowledgeGraphConfig.
let server: Server
const root = 'examples/vanilla-html'
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    try {
      const path = req.url === '/' ? '/local-test.html' : req.url!.split('?')[0]
      const body = await readFile(join(root, path))
      res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }[extname(path)] || 'text/plain' })
      res.end(body)
    } catch { res.writeHead(404); res.end() }
  }).listen(4603, '127.0.0.1')
})
test.afterAll(() => { server?.close() })

test('standalone knowledge-graph.js draws both sources and emits knowledgegraph:open', async ({ page }) => {
  await page.goto('http://127.0.0.1:4603/')
  await expect(page.locator('.og__hud')).toContainText('667 notes', { timeout: 30_000 })
  await expect(page.locator('.og__srcb')).toHaveText(['Links', 'Graphify'])
  await page.locator('[data-source="graphify"]').click()
  await expect(page.locator('.og__hud')).toContainText('2,948 nodes', { timeout: 30_000 })
  // Page-wide styles come only with the standalone script.
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('app')!).position)).toBe('fixed')
})
