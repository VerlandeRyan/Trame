import { expect, test } from '@playwright/test'

test('accueil en français, sans préfixe d\'URL', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR')
  await expect(page.getByTestId('home-title')).toHaveText('Trame')
  await expect(page.getByTestId('home-intro')).toContainText('Suis tes lectures')
})

test('accueil en anglais sous /en', async ({ page }) => {
  await page.goto('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB')
  await expect(page.getByTestId('home-intro')).toContainText('Track your reading')
})

test('le sélecteur de langue bascule vers /en', async ({ page }) => {
  await page.goto('/')
  // Attendre l'hydratation : sinon l'événement `change` peut précéder les écouteurs.
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Langue de l\'interface').selectOption('en')
  await expect(page).toHaveURL(/\/en\/?$/)
  await expect(page.getByTestId('home-intro')).toContainText('Track your reading')
})
