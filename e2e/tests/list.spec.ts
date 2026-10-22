import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { signUp } from '../support/session'

// Ma liste de lecture (US-07) : l'API, la base, la session et le relais Nuxt sont réels ; seul
// Google est remplacé (voir `auth.spec.ts`). Œuvres de démo sans lecteur ni ajout récent (2, 3, 4) :
// une entrée de plus n'y change ni « À la une » ni « Mieux notées ». Chaque test crée son lecteur.
const WORKS = { chroniques: 2, cap: 3, gardien: 4 }

test.describe.configure({ mode: 'serial' })

// Les entrées comptent dans « À la une » dès 3 ajouts : on les retire pour ne pas gêner l'accueil.
test.afterEach(async ({ context }) => {
  for (const workId of Object.values(WORKS)) {
    await context.request.delete(`/api/v1/works/${workId}/entry`)
  }
})

async function addEntry(
  context: BrowserContext,
  workId: number,
  entry: Record<string, unknown>,
): Promise<void> {
  const response = await context.request.put(`/api/v1/works/${workId}/entry`, {
    data: entry,
  })
  expect(response.status()).toBe(200)
}

/** Un lecteur avec trois œuvres : 15 chapitres et 4 tomes lus au total. */
async function signUpWithList(context: BrowserContext): Promise<void> {
  await signUp(context)
  await addEntry(context, WORKS.chroniques, {
    status: 'reading',
    chaptersRead: 5,
    volumesRead: 1,
  })
  await addEntry(context, WORKS.cap, {
    status: 'completed',
    chaptersRead: 10,
    volumesRead: 3,
    rating: 9,
  })
  await addEntry(context, WORKS.gardien, { status: 'plan_to_read' })
}

async function openList(page: Page, path = '/list'): Promise<void> {
  await page.goto(path)
  // Les compteurs et le défilement continu ne répondent qu'une fois la page hydratée.
  await page.waitForLoadState('networkidle')
}

const rows = (page: Page) => page.getByTestId('list-row')
const rowOf = (page: Page, title: string) => rows(page).filter({ hasText: title })

test('un visiteur est renvoyé à l’accueil', async ({ page }) => {
  await page.goto('/list')

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('list-table')).toHaveCount(0)
})

test('une liste vide propose d’explorer le catalogue', async ({ page, context }) => {
  await signUp(context)
  await openList(page)

  await expect(page.getByTestId('list-empty')).toContainText('Ta liste est vide')
  await page.getByTestId('list-empty').getByRole('link', { name: 'Explorer le catalogue' }).click()

  await expect(page).toHaveURL('/search')
})

test('liste les œuvres, compte chapitres et tomes séparément, filtre, cherche et trie', async ({
  page,
  context,
}) => {
  await signUpWithList(context)
  await openList(page)

  await expect(rows(page)).toHaveCount(3)
  await expect(page.getByTestId('list-total-chapters')).toContainText('15')
  await expect(page.getByTestId('list-total-volumes')).toContainText('4')
  await expect(page.getByRole('tab', { name: /^Tous/ })).toContainText('3')
  await expect(page.getByRole('tab', { name: /^En cours/ })).toContainText('1')

  // Les onglets filtrent par statut, l'adresse les garde.
  await page.getByRole('tab', { name: /^Terminé/ }).click()
  await expect(page).toHaveURL(/status=completed/)
  await expect(rows(page)).toHaveCount(1)
  await expect(rowOf(page, 'Cap sur les Archipels')).toBeVisible()
  // Les totaux restent ceux de toute la liste.
  await expect(page.getByTestId('list-total-chapters')).toContainText('15')
  await page.getByRole('tab', { name: /^Tous/ }).click()
  await expect(rows(page)).toHaveCount(3)

  await page.getByTestId('list-search').fill('gardien')
  await expect(page).toHaveURL(/q=gardien/)
  await expect(rows(page)).toHaveCount(1)
  await expect(rowOf(page, 'Le Gardien des Sables')).toBeVisible()
  await page.getByTestId('list-search').fill('')
  await expect(rows(page)).toHaveCount(3)

  await page.getByTestId('list-sort').click()
  await page.getByRole('option', { name: 'Titre (A → Z)' }).click()
  await expect(page).toHaveURL(/sort=title/)
  await expect(rows(page).first()).toContainText('Cap sur les Archipels')
})

test('un chapitre de plus est enregistré aussitôt, puis retrouvé au rechargement', async ({
  page,
  context,
}) => {
  await signUpWithList(context)
  await openList(page)

  await rowOf(page, 'Chroniques de Basalte')
    .getByRole('button', { name: 'Augmenter : Chapitres' })
    .click()

  await expect(page.getByTestId('list-total-chapters')).toContainText('16')
  await expect(page.getByTestId('list-total-volumes')).toContainText('4')
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('list-total-chapters')).toContainText('16')
  await expect(
    rowOf(page, 'Chroniques de Basalte').getByRole('textbox', {
      name: 'Chapitres',
      exact: true,
    }),
  ).toHaveValue('6')
})

test('commencer une œuvre « À lire » demande confirmation avant de la passer « En cours »', async ({
  page,
  context,
}) => {
  await signUpWithList(context)
  await openList(page)
  const row = rowOf(page, 'Le Gardien des Sables')

  await row.getByRole('button', { name: 'Augmenter : Chapitres' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByTestId('confirm-cancel').click()
  // Rien n'est enregistré et le compteur reprend sa valeur.
  await expect(row.getByTestId('list-status')).toContainText('À lire')
  await expect(row.getByRole('textbox', { name: 'Chapitres', exact: true })).toHaveValue('0')

  await row.getByRole('button', { name: 'Augmenter : Chapitres' }).click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()
  await expect(row.getByTestId('list-status')).toContainText('En cours')
  await expect(row.getByRole('textbox', { name: 'Chapitres', exact: true })).toHaveValue('1')
})

test('le statut se change depuis la ligne et l’œuvre quitte l’onglet affiché', async ({
  page,
  context,
}) => {
  await signUpWithList(context)
  await openList(page, '/list?status=reading')
  await expect(rows(page)).toHaveCount(1)

  await page.getByTestId('list-status').click()
  await page.getByTestId('list-status-on_hold').click()

  await expect(rows(page)).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /^En pause/ })).toContainText('1')
  await expect(page.getByRole('tab', { name: /^En cours/ })).toContainText('0')
})

test('« Modifier ma lecture » enregistre note et dates, puis retire l’œuvre', async ({
  page,
  context,
}) => {
  await signUpWithList(context)
  await openList(page)
  const row = rowOf(page, 'Chroniques de Basalte')

  await row.getByTestId('list-edit').click()
  const modal = page.getByTestId('list-edit-modal')
  await expect(modal).toContainText('Chroniques de Basalte')
  await modal.getByTestId('list-edit-rating').click()
  await modal.getByRole('option', { name: /^9 · Excellent/ }).click()
  await modal.locator('input[type="date"]').last().fill('2026-03-04')
  await page.getByTestId('list-edit-save').click()
  await expect(row.getByTestId('list-rating')).toHaveText('9 / 10')

  await page.reload()
  await page.waitForLoadState('networkidle')
  await rowOf(page, 'Chroniques de Basalte').getByTestId('list-edit').click()
  await expect(
    page.getByTestId('list-edit-modal').locator('input[type="date"]').last(),
  ).toHaveValue('2026-03-04')

  await page.getByTestId('list-edit-remove').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').first().click()
  await expect(rows(page)).toHaveCount(2)
  await expect(page.getByTestId('list-total-chapters')).toContainText('10')
})

test('la grille compte les chapitres puis les tomes avec −1 / +1', async ({ page, context }) => {
  await signUpWithList(context)
  await openList(page, '/list?view=grid')
  const item = page.getByTestId('list-grid-item').filter({ hasText: 'Chroniques de Basalte' })

  await expect(page.getByTestId('list-grid-item')).toHaveCount(3)
  await expect(item.getByTestId('list-grid-badge')).toHaveText('Ch. 5')
  await item.getByTestId('list-grid-plus').click()
  await expect(item.getByTestId('list-grid-badge')).toHaveText('Ch. 6')
  await item.getByTestId('list-grid-minus').click()
  await expect(item.getByTestId('list-grid-badge')).toHaveText('Ch. 5')

  await page.getByTestId('list-unit-volumes').click()
  await expect(item.getByTestId('list-grid-badge')).toHaveText('T. 1')
})

test('aucune violation d’accessibilité : liste, grille et fenêtre de modification', async ({
  page,
  context,
}) => {
  await signUpWithList(context)

  const expectNoViolation = async () => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  }

  await openList(page)
  await expectNoViolation()
  await rows(page).first().getByTestId('list-edit').click()
  await expect(page.getByTestId('list-edit-modal')).toBeVisible()
  await expectNoViolation()
  await page.keyboard.press('Escape')
  await openList(page, '/list?view=grid')
  await expectNoViolation()
})
