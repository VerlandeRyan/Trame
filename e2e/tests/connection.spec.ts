import { expect, test } from '@playwright/test'
import { waitForHydration } from '../support/hydration.js'

// Annonces de connexion : le navigateur perd puis retrouve le réseau pendant qu'une page est ouverte.
test('perdre puis retrouver la connexion est annoncé', async ({ page, context }) => {
  await page.goto('/')
  await waitForHydration(page)

  await context.setOffline(true)
  await expect(page.getByTestId('toast').filter({ hasText: 'hors connexion' })).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByTestId('toast').filter({ hasText: 'De nouveau en ligne' })).toBeVisible()
})
