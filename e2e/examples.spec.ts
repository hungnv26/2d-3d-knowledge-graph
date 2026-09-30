import { expect, test } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'

// The React and Vue examples, built and previewed, draw all three graphs and report opened nodes.
const run = (dir: string, port: number) => spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: `examples/${dir}`, stdio: 'ignore' })

for (const [dir, port] of [['react-vite', 4601], ['vue-vite', 4602]] as const) {
  test.describe(dir, () => {
    let server: ChildProcess
    test.beforeAll(async () => {
      server = run(dir, port)
      for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) return } catch { await new Promise((r) => setTimeout(r, 250)) } }
    })
    test.afterAll(() => { server?.kill() })
    test('three graphs mount, switch and tear down', async ({ page }) => {
      await page.goto(`http://127.0.0.1:${port}`)
      await expect(page.locator('.og__hud')).toContainText('667 notes', { timeout: 30_000 })
      await page.getByRole('button', { name: '3d', exact: true }).click()
      await expect(page.locator('.g3__hud')).toContainText('667 notes', { timeout: 30_000 })
      expect(await page.locator('.og').count()).toBe(0)
      await page.getByRole('button', { name: 'semantic', exact: true }).click()
      await expect(page.locator('.sg__hud')).toContainText('18 clusters', { timeout: 30_000 })
      expect(await page.locator('canvas').count()).toBe(1)
    })
  })
}
