import { expect, test } from '@playwright/test'
import { waitForHydration } from '../support/hydration.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/components')
  // Attendre l'hydratation : sinon un clic peut précéder les écouteurs d'événements.
  await waitForHydration(page)
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

// Norme #160 : cinq largeurs de couverture, pas une de plus.
test('les couvertures de la galerie ont les cinq largeurs normalisées', async ({ page }) => {
  const widths = await page
    .locator('.gallery__progress .cover')
    .evaluateAll((covers) => covers.map((cover) => Math.round(cover.getBoundingClientRect().width)))

  expect(widths).toEqual([64, 72, 96, 112, 210])
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

// Règles de #164 : bouton blanc → cover-empty ; bouton coloré → fond plus foncé, texte intact ;
// onglet courant jamais modifié par le survol.
test('survol à la souris : fonds des familles de boutons et des onglets', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'Pas de survol sur écran tactile')
  const coverEmpty = 'rgb(207, 216, 255)'
  const ink = 'rgb(27, 42, 92)'

  const white = page.getByRole('button', { name: 'Ajouter +' })
  await white.hover()
  await expect(white).toHaveCSS('background-color', coverEmpty)

  const completed = page.getByRole('button', { name: 'Terminé' })
  await completed.hover()
  await expect(completed).toHaveCSS('background-color', 'rgb(114, 144, 230)')
  await expect(completed).toHaveCSS('color', ink)

  const hoveredTab = page.getByRole('tab', { name: /En cours/ })
  await hoveredTab.hover()
  await expect(hoveredTab).toHaveCSS('background-color', coverEmpty)
  await page.getByRole('tab', { name: /Toutes/ }).hover()
  await expect(page.getByRole('tab', { name: /Toutes/ })).toHaveCSS('background-color', ink)

  const minus = page.getByRole('button', { name: 'Augmenter : Chapitres lus' })
  await minus.hover()
  await expect(minus).toHaveCSS('background-color', coverEmpty)
})

// Paliers d'inclinaison (#164) : l'angle suit la largeur du bouton, pas le composant.
test('survol à la souris : un bouton courant s’incline au palier medium (−1,6°)', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'Pas de survol sur écran tactile')
  const button = page.getByRole('button', { name: 'Ajouter à ma liste' })
  await button.hover()
  await expect
    .poll(async () => {
      const transform = await button.evaluate((element) => getComputedStyle(element).transform)
      const [a, b] = transform
        .replace(/matrix\(|\)/g, '')
        .split(',')
        .map(Number)
      return Math.round((Math.atan2(b!, a!) * 1800) / Math.PI) / 10
    })
    .toBe(-1.6)
})

test("la modale s'ouvre et se ferme", async ({ page }) => {
  await page.getByRole('button', { name: 'Ajouter +' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Fermer' }).click()
  await expect(dialog).toBeHidden()
})
