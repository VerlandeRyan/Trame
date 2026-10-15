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
]

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
