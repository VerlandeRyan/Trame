import { expect, test } from '@playwright/test'

// L'accueil porte son propre champ de recherche : ces contrôles de l'en-tête se font sur une fiche.
const WORK_PATH = '/work/1-les-lanternes-de-brume'

test('l\'en-tête présente la recherche et la connexion', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(WORK_PATH)
  const header = page.getByRole('banner')
  await expect(header.getByRole('combobox')).toHaveAttribute(
    'placeholder',
    'Rechercher une œuvre, un auteur…',
  )
  await expect(header.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible()
})

test('« Se connecter » est le bouton bleu de l\'en-tête', async ({ page }) => {
  await page.goto('/')
  const signIn = page.getByRole('banner').getByRole('button', { name: 'Se connecter', exact: true })
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

test('mobile : recherche, langue, compte et ☰ sont groupés à droite de l\'en-tête', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(WORK_PATH)

  const search = await page.locator('.layout-header__search-link').boundingBox()
  const signIn = await page.getByRole('button', { name: 'Se connecter', exact: true }).boundingBox()
  const menu = await page.getByTestId('explore-open').boundingBox()
  const logo = await page.locator('.layout-header__logo').boundingBox()
  expect(search && signIn && menu && logo).toBeTruthy()
  // Le ☰ touche la marge droite (12 px), le compte le précède ; la recherche est à droite du logo,
  // pas collée à lui.
  expect(Math.round(390 - (menu!.x + menu!.width))).toBeLessThanOrEqual(14)
  expect(menu!.x - (signIn!.x + signIn!.width)).toBeLessThan(14)
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
  const signIn = await page.getByRole('button', { name: 'Se connecter', exact: true }).boundingBox()
  expect(signIn!.x + signIn!.width).toBeLessThanOrEqual(320)
})

test('bureau : Explorer ouvre formats et genres avec compteurs, Échap rend le focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(WORK_PATH)
  await page.waitForLoadState('networkidle')

  const trigger = page.getByTestId('explore-open')
  const panel = page.getByTestId('explore-panel')
  await expect(panel).toBeHidden()
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(panel).toBeVisible()
  const firstFormat = panel.locator('[data-testid^="explore-format-"]').first()
  await expect(firstFormat).toBeVisible()
  await expect(firstFormat).toContainText(/\d+ œuvres?/)

  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('bureau : un clic à l\'extérieur ferme Explorer, un format mène à la recherche filtrée', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(WORK_PATH)
  await page.waitForLoadState('networkidle')

  const trigger = page.getByTestId('explore-open')
  const panel = page.getByTestId('explore-panel')
  await trigger.click()
  await expect(panel).toBeVisible()
  await page.locator('main').click({ position: { x: 5, y: 400 } })
  await expect(panel).toBeHidden()

  await trigger.click()
  await panel.locator('[data-testid^="explore-format-"]').first().click()
  await expect(page).toHaveURL(/\/search\?format=/)
  // Sur la recherche, le bouton disparaît : la page porte ses propres filtres.
  await expect(page.getByTestId('explore-open')).toHaveCount(0)
})

test('bureau : « Voir tout le catalogue » mène à la recherche', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('explore-open').click()
  await page.getByTestId('explore-all-catalog').click()
  await expect(page).toHaveURL(/\/search$/)
})

test('bureau : la recherche remplit l\'espace entre le logo et Explorer, collé à la langue', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 })
  await page.goto(WORK_PATH)

  const search = await page.locator('.layout-header__search').boundingBox()
  const logo = await page.locator('.layout-header__logo').boundingBox()
  const explore = await page.getByTestId('explore-open').boundingBox()
  const language = await page.getByRole('button', { name: "Langue de l'interface" }).boundingBox()
  expect(search!.x - (logo!.x + logo!.width)).toBeLessThan(40)
  expect(explore!.x - (search!.x + search!.width)).toBeLessThan(20)
  expect(language!.x - (explore!.x + explore!.width)).toBeLessThan(20)
})

test('bureau : le bouton reste blanc ouvert, la fenêtre reste dans l\'écran à 800 px', async ({
  page,
}) => {
  for (const width of [800, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(WORK_PATH)
    await page.waitForLoadState('networkidle')
    await page.getByTestId('explore-open').click()
    const panel = page.getByTestId('explore-panel')
    await expect(panel.locator('[data-testid^="explore-format-"]').first()).toBeVisible()
    const box = await panel.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    await expect(page.getByTestId('explore-open')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    )
  }
})

test('mobile : ☰ ouvre Explorer, recherche et menu s\'excluent, zones de clic ≥ 44 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(WORK_PATH)
  await page.waitForLoadState('networkidle')

  const trigger = page.getByTestId('explore-open')
  const box = await trigger.boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(box!.height).toBeGreaterThanOrEqual(44)

  await trigger.click()
  await expect(page.getByTestId('explore-panel')).toBeVisible()
  await expect(trigger).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  // Le volet occupe toute la largeur, sous l'en-tête.
  const panelBox = await page.getByTestId('explore-panel').boundingBox()
  expect(Math.round(panelBox!.width)).toBe(390)

  // Ouvrir la recherche referme le menu : une seule croix à l'écran.
  await page.getByTestId('search-open').click()
  await expect(page.getByTestId('explore-panel')).toBeHidden()
  await expect(trigger).toBeHidden()
  await expect(page.getByTestId('search-close')).toBeVisible()
  await page.getByTestId('search-close').click()
  await expect(trigger).toBeVisible()
})

test('petit mobile (320 px) : ☰ et volet ouvert sans défilement horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(WORK_PATH)
  await page.waitForLoadState('networkidle')
  await page.getByTestId('explore-open').click()
  await expect(page.getByTestId('explore-panel')).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  const signIn = await page.getByRole('button', { name: 'Se connecter', exact: true }).boundingBox()
  expect(signIn!.x + signIn!.width).toBeLessThanOrEqual(320)
})

test('bureau : après un lien du menu puis le retour, Explorer se rouvre avec ses listes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const trigger = page.getByTestId('explore-open')
  const panel = page.getByTestId('explore-panel')
  await trigger.click()
  await panel.locator('[data-testid^="explore-format-"]').first().click()
  await expect(page).toHaveURL(/\/search\?format=/)

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  // Le menu revient fermé, puis s'ouvre avec formats et genres.
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(panel).toBeHidden()
  await trigger.click()
  await expect(panel.locator('[data-testid^="explore-format-"]').first()).toBeVisible()
  await expect(panel.locator('[data-testid^="explore-genre-"]').first()).toBeVisible()
})

test('mobile : le titre « Explorer » replie et déplie le volet, le ☰ passe devant la trame', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const trigger = page.getByTestId('explore-open')
  // Le centre du bouton appartient au bouton, pas à la trame de l'en-tête.
  const ownsCenter = await trigger.evaluate((button) => {
    const rect = button.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return button.contains(hit)
  })
  expect(ownsCenter).toBe(true)

  await trigger.click()
  const fold = page.getByTestId('explore-fold')
  const cards = page.locator('[data-testid^="explore-format-"]').first()
  await expect(cards).toBeVisible()
  await expect(fold).toHaveAttribute('aria-expanded', 'true')

  await fold.click()
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect(cards).toBeHidden()
  await expect(page.getByTestId('explore-all-catalog')).toBeHidden()

  await fold.click()
  await expect(cards).toBeVisible()
})

test('en anglais : le contenu du menu Explorer est traduit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/en')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('explore-open').click()
  const panel = page.getByTestId('explore-panel')
  await expect(panel).toContainText('Find your next read by format or genre.')
  await expect(panel).toContainText('See the whole catalogue')
  await expect(panel.locator('[data-testid^="explore-format-"]').first()).toContainText(/\d+ works?/)
  await expect(panel).not.toContainText('œuvre')
})
