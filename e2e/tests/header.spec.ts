import { expect, test } from '@playwright/test'

test('l\'en-tête présente la recherche et la connexion', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const header = page.getByRole('banner')
  await expect(header.getByRole('combobox')).toHaveAttribute(
    'placeholder',
    'Rechercher une œuvre, un auteur…',
  )
  await expect(header.getByRole('button', { name: 'Se connecter' })).toBeVisible()
})

test('« Se connecter » est le bouton bleu de l\'en-tête', async ({ page }) => {
  await page.goto('/')
  const signIn = page.getByRole('banner').getByRole('button', { name: 'Se connecter' })
  await expect(signIn).toHaveCSS('background-color', 'rgb(35, 64, 184)')
  await expect(signIn).toHaveCSS('color', 'rgb(255, 255, 255)')
})

test('le lien d\'évitement mène au contenu', async ({ page }) => {
  await page.goto('/')
  const skipLink = page.getByRole('link', { name: 'Aller au contenu' })
  await skipLink.focus()
  await expect(skipLink).toBeVisible()
  await skipLink.press('Enter')
  await expect(page).toHaveURL(/#contenu$/)
})

test('pas de défilement horizontal de la page', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('mobile : recherche, langue et compte sont groupés à droite de l\'en-tête', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const search = await page.locator('.layout-header__search-link').boundingBox()
  const signIn = await page.getByRole('button', { name: 'Se connecter' }).boundingBox()
  const logo = await page.locator('.layout-header__logo').boundingBox()
  expect(search && signIn && logo).toBeTruthy()
  // Le compte touche la marge droite (12 px) ; la recherche est à droite du logo, pas collée à lui.
  expect(Math.round(390 - (signIn!.x + signIn!.width))).toBeLessThanOrEqual(14)
  expect(search!.x - (logo!.x + logo!.width)).toBeGreaterThan(24)
})

test('le menu des langues est intégré, calé sur le bouton, et se ferme avec Échap', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const trigger = page.getByRole('button', { name: "Langue de l'interface" })
  // Toute la carte répond : un clic sur la marge gauche, à côté du globe, ouvre aussi le menu.
  await trigger.click({ position: { x: 3, y: 22 } })
  const menu = page.locator('.language-switcher__menu')
  await expect(menu).toBeVisible()

  // Menu aligné sur le bord droit du bouton, sans prendre toute la largeur de l'écran.
  const box = await menu.boundingBox()
  const triggerBox = await trigger.boundingBox()
  expect(box!.width).toBeLessThan(300)
  expect(Math.abs(box!.x + box!.width - (triggerBox!.x + triggerBox!.width))).toBeLessThanOrEqual(1)

  // La trame de l'en-tête ne passe pas devant le bouton ni devant le menu.
  const topmost = await page.evaluate(() => {
    const centerOf = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect()
      return [rect.x + rect.width / 2, rect.y + rect.height / 2] as const
    }
    const owner = (selector: string) => {
      const [x, y] = centerOf(selector)
      return document.elementFromPoint(x, y)?.closest(selector) !== null
    }
    return {
      trigger: owner('.language-switcher__trigger'),
      menu: owner('.language-switcher__menu'),
    }
  })
  expect(topmost).toEqual({ trigger: true, menu: true })

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('petit mobile (320 px) : l\'en-tête tient sur une ligne, menu des langues ouvert compris', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: "Langue de l'interface" }).click()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  const signIn = await page.getByRole('button', { name: 'Se connecter' }).boundingBox()
  expect(signIn!.x + signIn!.width).toBeLessThanOrEqual(320)
})
