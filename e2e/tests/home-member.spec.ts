import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { waitForHydration } from '../support/hydration.js'
import { signUp } from '../support/session.js'

// Accueil d'un membre connecté (US-15, #96) : l'API, la base, la session et le relais Nuxt sont
// réels. Œuvre de démo sans lecteur ni ajout récent (n° 2) : une entrée de plus n'y change ni
// « À la une » ni « Mieux notées ». Chaque test crée son lecteur.
const CHRONIQUES = 2

test.describe.configure({ mode: 'serial' })

test.afterEach(async ({ context }) => {
  await context.request.delete(`/api/v1/works/${CHRONIQUES}/entry`)
})

async function openHome(page: Page): Promise<void> {
  await page.goto('/')
  // Le +1 et les liens ne répondent qu'une fois la page hydratée.
  await waitForHydration(page)
}

async function expectNoAccessibilityViolation(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations.map((violation) => violation.id)).toEqual([])
}

test('« Reprendre la lecture » au mobile : titre, format · chapitre, puis le statut en 3e ligne', async ({
  page,
  context,
}) => {
  await signUp(context)
  await context.request.put(`/api/v1/works/${CHRONIQUES}/entry`, {
    data: { status: 'reading', chaptersRead: 5 },
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await openHome(page)

  const item = page.getByTestId('continue-reading-work')
  const title = (await item.locator('.continue-reading__work-title').boundingBox())!
  const progress = (await item.getByTestId('continue-reading-progress').boundingBox())!
  const status = (await item.locator('.continue-reading__status').boundingBox())!

  expect(progress.y).toBeGreaterThanOrEqual(title.y + title.height)
  expect(status.y).toBeGreaterThanOrEqual(progress.y + progress.height)
})

test('un membre avec une lecture en cours la reprend d’un +1, sans panneau visiteur', async ({
  page,
  context,
}) => {
  const handle = await signUp(context)
  const added = await context.request.put(`/api/v1/works/${CHRONIQUES}/entry`, {
    data: { status: 'reading', chaptersRead: 5 },
  })
  expect(added.status()).toBe(200)

  await openHome(page)

  await expect(page.getByTestId('home-title')).toHaveText(`Bon retour, @${handle}`)
  await expect(page.getByTestId('home-intro')).toHaveText('Où en es-tu dans tes lectures ?')
  for (const hidden of ['home-pitch', 'home-stamps', 'home-formats']) {
    await expect(page.getByTestId(hidden)).toHaveCount(0)
  }
  const continued = page.getByTestId('continue-reading-work')
  await expect(continued).toHaveCount(1)
  await expect(continued.getByTestId('continue-reading-progress')).toHaveText('Manga · Chapitre 5')
  await expectNoAccessibilityViolation(page)

  const saved = page.waitForResponse(
    (response) => response.url().includes('/entry') && response.request().method() === 'PUT',
  )
  await continued.getByTestId('continue-reading-add-one').click()
  await saved
  await expect(continued.getByTestId('continue-reading-progress')).toHaveText('Manga · Chapitre 6')
  await page.reload()
  await waitForHydration(page)
  await expect(page.getByTestId('continue-reading-progress')).toHaveText('Manga · Chapitre 6')

  await page.getByTestId('home-continue-reading-list-link').click()
  await expect(page).toHaveURL('/list')
})

// #164 : le « +1 » est incliné au survol (palier small) et, appuyé, s'enfonce de 2 px sur son
// ombre comme tout bouton qui en a une.
test('le +1 s’incline au survol et s’enfonce de 2 px à l’appui', async ({
  page,
  context,
  hasTouch,
}) => {
  test.skip(hasTouch, 'Pas de survol sur écran tactile')
  await signUp(context)
  await context.request.put(`/api/v1/works/${CHRONIQUES}/entry`, {
    data: { status: 'reading', chaptersRead: 5 },
  })
  await openHome(page)

  const addOne = page.getByTestId('continue-reading-add-one')
  await addOne.hover()
  await expect(addOne).not.toHaveCSS('transform', 'none')

  await page.mouse.down()
  await expect(addOne).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 2, 2)')
  await expect(addOne).toHaveCSS('box-shadow', 'rgb(27, 42, 92) 1px 1px 0px 0px')
  await page.mouse.up()
})

test('un +1 perdu par une panne réseau revient à la valeur d’avant et prévient le membre', async ({
  page,
  context,
}) => {
  await signUp(context)
  const added = await context.request.put(`/api/v1/works/${CHRONIQUES}/entry`, {
    data: { status: 'reading', chaptersRead: 5 },
  })
  expect(added.status()).toBe(200)
  await openHome(page)
  const progress = page.getByTestId('continue-reading-progress')
  await expect(progress).toHaveText('Manga · Chapitre 5')

  await page.route('**/api/v1/works/*/entry', (route) =>
    route.request().method() === 'PUT' ? route.abort('connectionfailed') : route.continue(),
  )
  await page.getByTestId('continue-reading-add-one').click()

  await expect(page.getByTestId('continue-reading-error')).toBeVisible()
  await expect(progress).toHaveText('Manga · Chapitre 5')
  await page.unroute('**/api/v1/works/*/entry')
  const stored = await context.request.get(`/api/v1/works/${CHRONIQUES}/entry`)
  expect((await stored.json()).entry.chaptersRead).toBe(5)
})

test('un membre sans œuvre est accueilli et part d’un format', async ({ page, context }) => {
  const handle = await signUp(context)

  await openHome(page)

  await expect(page.getByTestId('home-title')).toHaveText(`Bienvenue sur Trame, @${handle}`)
  await expect(page.getByTestId('home-intro')).toContainText('Ta liste est vide')
  await expect(page.getByTestId('home-continue-reading')).toHaveCount(0)
  await expect(page.getByTestId('home-pitch')).toHaveCount(0)
  await expectNoAccessibilityViolation(page)

  // Le hero est centré, pas le menu de suggestions.
  await page.getByRole('combobox').fill('basalte')
  await expect(page.getByRole('listbox')).toHaveCSS('text-align', 'start')
  await page.getByRole('combobox').fill('')

  await page.getByTestId('home-format-manga').click()
  await expect(page).toHaveURL(/\/search\?format=manga/)
})
