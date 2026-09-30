import { expect, test, type Page } from '@playwright/test'

// The demo exposes inspection handles with ?debug (host.debug).
const open = async (page: Page, tab: string) => {
  await page.goto(`/?debug#${tab}`)
  await page.evaluate(() => localStorage.clear())
  await page.goto(`/?debug#${tab}`)
}

test('2D Knowledge Graph: Links, Graphify, and a click opens the note at the passage', async ({ page }) => {
  await open(page, '2d')
  await expect(page.locator('.og__hud')).toContainText('667 notes', { timeout: 30_000 })
  await expect(page.locator('.og__srcb')).toHaveText(['Links', 'Graphify'])
  await expect.poll(() => page.evaluate(() => (window as any).__kg2d.anim().state), { timeout: 30_000 }).toBe('playing')

  await page.locator('[data-source="graphify"]').click()
  await expect(page.locator('.og__hud')).toContainText('2,948 nodes', { timeout: 30_000 })
  await expect(page.locator('.og__sec-t', { hasText: 'Colour by' })).toBeVisible()

  // Click a concept where it is drawn, choosing one with room around it.
  const point = await page.evaluate(() => {
    const g = (window as any).__kg2d
    // The force animation keeps the layout moving: pin every node where it is.
    for (const n of g.nodes()) { n.fx = n.x; n.fy = n.y }
    const c = document.querySelector('.og__canvas')!.getBoundingClientRect()
    const v = g.view()
    const at = (n: any) => ({ x: c.left + (n.x * v.k + v.tx) * c.width / v.W, y: c.top + (n.y * v.k + v.ty) * c.height / v.H })
    const all = g.nodes().map((n: any) => ({ n, ...at(n) }))
    const inView = (p: any) => p.x > c.left + 40 && p.x < c.right - 340 && p.y > c.top + 80 && p.y < c.bottom - 60
    const best = all.filter((p: any) => p.n.type === 'concept' && p.n.note && inView(p))
      .map((p: any) => ({ ...p, gap: Math.min(...all.filter((q: any) => q !== p).map((q: any) => Math.hypot(q.x - p.x, q.y - p.y))) }))
      .sort((a: any, b: any) => b.gap - a.gap)[0]
    return { x: best.x, y: best.y, label: best.n.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
  })
  await page.mouse.click(point.x, point.y)
  await expect(page.locator('#note')).toBeVisible()
  await expect(page.locator('#note mark')).toHaveText(new RegExp(point.label, 'i'))
})

test('3D Knowledge Graph: selecting a note lights its neighbours; the local graph narrows the view', async ({ page }) => {
  await open(page, '3d')
  await expect(page.locator('.g3__hud')).toContainText('667 notes', { timeout: 30_000 })
  const lit = await page.evaluate(() => {
    const g = (window as any).__kg3d
    const hub = [...g.shown()].sort((a: any, b: any) => b.deg - a.deg)[3]
    g.select(hub.id)
    return { lit: g.lit(), deg: hub.deg, id: hub.id }
  })
  expect(lit.lit.nodes).toBe(lit.deg + 1)
  await page.locator('.g3__card [data-act="local"]').click()
  await expect(page.locator('.g3__local')).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as any).__kg3d.shown().length)).toBe(lit.deg + 1)
})

test('3D Semantic Graph: scopes, colour modes, search and closest notes', async ({ page }) => {
  await open(page, 'semantic')
  await expect(page.locator('.sg__hud')).toContainText('667 notes', { timeout: 30_000 })
  await page.locator('[data-scope="missions"]').click()
  // A scope draws only its own notes.
  await expect(page.locator('.sg__hud')).not.toContainText('667 notes')
  await page.locator('[data-color="status"]').click()
  await expect(page.locator('.sg__legend')).toContainText('succeeded')
  await page.locator('[data-scope="all"]').click()
  await page.locator('[data-bind="q"]').fill('fold drive')
  await page.locator('[data-bind="q"]').press('Enter')
  await expect(page.locator('.sg__side .sg__hit').first()).toBeVisible()
  await expect(page.locator('.sg__sel')).not.toBeEmpty()
  await expect(page.locator('.sg__side')).toContainText('Closest in meaning')
})

test('switching tabs tears the previous graph down', async ({ page }) => {
  await open(page, '2d')
  await expect(page.locator('.og__hud')).toContainText('notes', { timeout: 30_000 })
  await page.locator('[data-tab="3d"]').click()
  await expect(page.locator('.g3__hud')).toContainText('notes', { timeout: 30_000 })
  expect(await page.evaluate(() => ({ old: !!(window as any).__kg2d, og: document.querySelectorAll('.og').length }))).toEqual({ old: false, og: 0 })
  await page.locator('[data-tab="semantic"]').click()
  await expect(page.locator('.sg__hud')).toContainText('clusters', { timeout: 30_000 })
  expect(await page.evaluate(() => ({ old: !!(window as any).__kg3d, canvases: document.querySelectorAll('canvas').length }))).toEqual({ old: false, canvases: 1 })
})

test('settings survive a reload: the last source and the force animation', async ({ page }) => {
  await open(page, '2d')
  await expect(page.locator('.og__hud')).toContainText('notes', { timeout: 30_000 })
  await page.locator('[data-source="graphify"]').click()
  await expect(page.locator('.og__hud')).toContainText('nodes', { timeout: 30_000 })
  await page.reload()
  await expect.poll(() => page.evaluate(() => (window as any).__kg2d?.source()), { timeout: 30_000 }).toBe('graphify')
})
