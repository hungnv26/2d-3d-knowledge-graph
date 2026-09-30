import { test, type Page } from '@playwright/test'

// Captures the README images: SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture the README images')

// A fresh page load for each graph, so nothing from the last one (the note panel) stays open.
const go = async (page: Page, tab: string, wait = 12000) => {
  await page.goto(`/?debug&t=${tab}#${tab}`)
  await page.waitForTimeout(wait)
}
const shot = (page: Page, file: string) => page.screenshot({ path: `docs/images/${file}` })

// Click a node where it is drawn, choosing one with room around it.
const clickConcept = async (page: Page) => {
  const p = await page.evaluate(() => {
    const g = (window as any).__kg2d
    for (const n of g.nodes()) { n.fx = n.x; n.fy = n.y }
    const c = document.querySelector('.og__canvas')!.getBoundingClientRect()
    const v = g.view()
    const at = (n: any) => ({ x: c.left + (n.x * v.k + v.tx) * c.width / v.W, y: c.top + (n.y * v.k + v.ty) * c.height / v.H })
    const all = g.nodes().map((n: any) => ({ n, ...at(n) }))
    const inView = (q: any) => q.x > c.left + 200 && q.x < c.right - 520 && q.y > c.top + 120 && q.y < c.bottom - 120
    const best = all.filter((q: any) => q.n.type === 'concept' && q.n.note && q.n.deg >= 2 && inView(q))
      .map((q: any) => ({ ...q, gap: Math.min(...all.filter((r: any) => r !== q).map((r: any) => Math.hypot(r.x - q.x, r.y - q.y))) }))
      .sort((a: any, b: any) => b.gap - a.gap)[0]
    return { x: best.x, y: best.y }
  })
  await page.mouse.move(p.x, p.y)
  await page.waitForTimeout(600)
  await page.mouse.click(p.x, p.y)
}

test('README screenshots', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())

  // 2D, Links
  await go(page, '2d')
  await shot(page, '2d-links.png')

  // 2D, Graphify, coloured by folder, then by community with the legend
  await page.locator('[data-source="graphify"]').click()
  await page.waitForTimeout(12000)
  await shot(page, '2d-graphify.png')
  await page.evaluate(() => { const t = document.querySelector<HTMLElement>('[data-toggle="groups"]'); if (t && !document.querySelector('[data-sec="groups"].is-closed')) t.click() })
  await page.evaluate(() => { const t = document.querySelector<HTMLElement>('[data-toggle="legend"]'); if (t && document.querySelector('[data-sec="legend"].is-closed')) t.click() })
  await page.locator('[data-mode="community"]').click()
  await page.waitForTimeout(1500)
  await shot(page, '2d-communities.png')

  // A Graphify concept clicked: its note opens at the passage that names it
  await page.locator('[data-mode="groups"]').click()
  await page.locator('.og__panel [data-act="close"]').click()
  await page.evaluate(() => { const k = (window as any).__kg2d; k.fit() })
  await page.waitForTimeout(1500)
  await clickConcept(page)
  await page.waitForTimeout(1500)
  await shot(page, '2d-open-note.png')

  // 3D, a hub selected
  await go(page, '3d')
  await page.evaluate(() => { const g = (window as any).__kg3d; const hub = [...g.shown()].sort((a: any, b: any) => b.deg - a.deg)[2]; g.select(hub.id) })
  await page.waitForTimeout(1500)
  await shot(page, '3d-knowledge.png')

  // 3D, the local graph of a crew member
  await page.evaluate(() => { const g = (window as any).__kg3d; const n = g.shown().find((x: any) => x.id === 'crew/captain-ines-vantablack.md') || g.shown()[0]; g.select(n.id); g.local(n.id) })
  await page.waitForTimeout(6000)
  await page.locator('[data-act="depth+"]').click()
  await page.locator('.g3__panel [data-act="close"]').click()
  await page.waitForTimeout(6000)
  await shot(page, '3d-local.png')

  // Semantic, whole archive
  await go(page, 'semantic', 10000)
  await shot(page, '3d-semantic.png')

  // Semantic, coloured by mission status, with a search by meaning
  await page.locator('[data-color="status"]').click()
  await page.locator('[data-bind="q"]').fill('choir moss song')
  await page.locator('[data-bind="q"]').press('Enter')
  await page.waitForTimeout(5000)
  await shot(page, '3d-semantic-search.png')
})
