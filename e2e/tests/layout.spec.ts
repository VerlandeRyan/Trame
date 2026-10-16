import { expect, test } from '@playwright/test'

// La trame de points du bord droit est un décor : présente sur toutes les pages, collée au bord
// droit, sans jamais capter un clic.
for (const path of ['/search?q=basalte', '/work/1-les-lanternes-de-brume']) {
  test(`trame décorative au bord droit : ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(path)

    const trame = page.locator('.layout__trame')
    await expect(trame).toHaveAttribute('aria-hidden', 'true')
    await expect(trame).toHaveCSS('pointer-events', 'none')
    await expect(trame).toHaveCSS('position', 'fixed')
    const box = await trame.boundingBox()
    expect(Math.round(box!.x + box!.width)).toBe(1280)
    expect(box!.width).toBeGreaterThan(300)
  })
}

test('accueil : la trame du bord droit s’arrête au filet du hero', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  // Pas de colonne fixe : la trame appartient au hero, dont elle ne dépasse pas le filet.
  await expect(page.locator('.layout__trame')).toHaveCount(0)
  const dots = await page
    .locator('.home__hero')
    .evaluate((hero) => getComputedStyle(hero, '::before').backgroundImage)
  expect(dots).toContain('radial-gradient')

  await page.evaluate(() => window.scrollTo(0, 300))
  const hero = await page.locator('.home__hero').boundingBox()
  expect(hero!.y + hero!.height).toBeLessThan(800)
})

test('la trame ne capte aucun clic : le contenu au-dessus reçoit les siens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const stolen = await page.evaluate(() => {
    const target = document.querySelector('[data-testid="home-propose"]')!
    target.scrollIntoView({ block: 'center' })
    const box = target.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return hit !== null && (hit === target || target.contains(hit)) ? null : hit?.className
  })

  expect(stolen).toBeNull()
})
