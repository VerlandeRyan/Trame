import { expect, test } from '@playwright/test'

test.describe('galerie de composants désactivée (production)', () => {
  test.use({ baseURL: 'http://127.0.0.1:3201' })

  test('/components répond 404', async ({ page }) => {
    const response = await page.goto('/components')
    expect(response?.status()).toBe(404)
  })

  test('l\'accueil ne propose pas le lien vers la galerie', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-title')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voir les composants' })).toHaveCount(0)
  })
})

test('page introuvable : statut 404 et retour à l\'accueil', async ({ page }) => {
  const response = await page.goto('/cette-page-n-existe-pas')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()

  await page.getByRole('button', { name: 'Retour à l\'accueil' }).click()
  await expect(page).toHaveURL('/')
})
