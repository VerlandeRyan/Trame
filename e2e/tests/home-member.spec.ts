import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signUp } from '../support/session'

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
  await page.waitForLoadState('networkidle')
}

async function expectNoAccessibilityViolation(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations.map((violation) => violation.id)).toEqual([])
}

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
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('continue-reading-progress')).toHaveText('Manga · Chapitre 6')

  await page.getByTestId('home-continue-reading-list-link').click()
  await expect(page).toHaveURL('/list')
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
