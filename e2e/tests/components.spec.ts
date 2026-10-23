import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/components')
  // Attendre l'hydratation : sinon un clic peut précéder les écouteurs d'événements.
  await page.waitForLoadState('networkidle')
})

test('le compteur est borné et saisissable', async ({ page }) => {
  const chapters = page.getByRole('textbox', { name: 'Chapitres lus' })
  await expect(chapters).toHaveValue('12')

  await page.getByRole('button', { name: 'Augmenter : Chapitres lus' }).click()
  await expect(chapters).toHaveValue('13')

  await chapters.fill('abc')
  await chapters.press('Tab')
  await expect(chapters).toHaveValue('0')
  await expect(page.getByRole('button', { name: 'Diminuer : Chapitres lus' })).toBeDisabled()

  const volumes = page.getByRole('textbox', { name: 'Tomes lus' })
  await volumes.fill('500')
  await volumes.press('Tab')
  await expect(volumes).toHaveValue('99')
})

test('les onglets se parcourent au clavier', async ({ page }) => {
  const tabs = page.getByRole('tab')
  await tabs.first().focus()
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('End')
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
})

test("la modale s'ouvre et se ferme", async ({ page }) => {
  await page.getByRole('button', { name: 'Ajouter +' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Fermer' }).click()
  await expect(dialog).toBeHidden()
})
