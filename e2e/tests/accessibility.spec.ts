import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Contrôle automatique d'accessibilité (WCAG 2 A et AA) sur chaque page existante.
const pages = [
  { name: 'accueil', path: '/' },
  { name: 'accueil en anglais', path: '/en' },
  { name: 'galerie de composants', path: '/components' },
  { name: 'fiche œuvre', path: '/work/42-les-lanternes-de-brume' },
  { name: 'fiche œuvre en anglais', path: '/en/work/42-the-mist-lanterns' },
  { name: 'page introuvable', path: '/cette-page-n-existe-pas' },
  { name: 'résultats de recherche', path: '/search?q=brume&type=series' },
  { name: 'recherche sans résultat', path: '/search?q=xyzqw' },
]

// États ouverts de la recherche : menu de suggestions, menu de tri, feuille de filtres mobile.
// Ils ne sont pas dans le DOM initial, donc un contrôle de la page chargée ne les voit pas.
async function expectNoViolation(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations.map((violation) => violation.id)).toEqual([])
}

test("aucune violation d'accessibilité : suggestions ouvertes", async ({ page }) => {
  // Le champ de l'en-tête n'existe qu'au bureau (le mobile le déploie depuis une icône).
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/search?q=brume')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('search-input').first().fill('lanternes')
  await expect(page.getByTestId('search-suggestions').first()).toBeVisible()

  await expectNoViolation(page)
})

test("aucune violation d'accessibilité : menu de tri ouvert", async ({ page }) => {
  await page.goto('/search?q=brume')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('search-sort').click()
  await expect(page.getByRole('option', { name: 'Pertinence' })).toBeVisible()

  await expectNoViolation(page)
})

test("aucune violation d'accessibilité : feuille de filtres mobile ouverte", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/search?q=brume&type=series')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /^Filtres/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await expectNoViolation(page)
})

for (const { name, path } of pages) {
  test(`aucune violation d'accessibilité : ${name}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
}
