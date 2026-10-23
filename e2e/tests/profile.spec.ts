import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type BrowserContext } from '@playwright/test'
import { signUp } from '../support/session.js'

// Profil public (US-08) : l'API, la base, la session et le relais Nuxt sont réels ; seul Google est
// remplacé. Mêmes œuvres de démo que la liste (2, 3, 4), retirées après chaque test.
const WORKS = { chroniques: 2, cap: 3, gardien: 4 }

test.describe.configure({ mode: 'serial' })

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

/** Un membre avec trois œuvres : 15 chapitres et 4 tomes lus, une note de 9. */
async function signUpWithList(context: BrowserContext): Promise<string> {
  const handle = await signUp(context)
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
  return handle
}

test('un visiteur voit les statistiques séparées et les listes du profil', async ({
  context,
  page,
}) => {
  const handle = await signUpWithList(context)
  await context.clearCookies()

  await page.goto(`/u/${handle}`)

  await expect(page.getByTestId('profile-handle')).toHaveText(`@${handle}`)
  await expect(page.getByTestId('profile-chapters')).toContainText('15')
  await expect(page.getByTestId('profile-volumes')).toContainText('4')
  await expect(page.getByTestId('profile-followed')).toHaveText('3')
  await expect(page.getByTestId('profile-average')).toContainText('9,0')
  await expect(page.getByTestId('profile-recent')).toContainText('Cap sur les Archipels')
  await expect(page.getByTestId('profile-top-rated')).toContainText('9 / 10')
  await expect(page.getByTestId('profile-visibility')).toHaveCount(0)
})

test('sa liste est en lecture seule', async ({ context, page }) => {
  const handle = await signUpWithList(context)
  await context.clearCookies()

  await page.goto(`/u/${handle}`)
  await page.getByTestId('profile-list-link').click()
  await page.waitForURL(`**/u/${handle}/list`)

  await expect(page.getByTestId('list-row')).toHaveCount(3)
  await expect(page.getByTestId('list-edit')).toHaveCount(0)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
})

test('son propriétaire retrouve son profil par le menu et le passe en privé', async ({
  browser,
  context,
  page,
  baseURL,
}) => {
  const handle = await signUpWithList(context)
  await page.goto('/')
  await page.getByTestId('account-menu').click()
  await page.getByTestId('profile-link').click()
  await page.waitForURL(`**/u/${handle}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('profile-visibility')).toContainText('Profil public')
  await page.getByTestId('profile-visibility-toggle').click()
  await expect(page.getByTestId('profile-visibility')).toContainText('Profil privé')

  const visitor = await browser.newContext({ baseURL })
  const visitorPage = await visitor.newPage()
  await visitorPage.goto(`/u/${handle}`)
  await expect(visitorPage.getByTestId('profile-private')).toContainText('Ce profil est privé')
  await expect(visitorPage.getByTestId('profile-recent')).toHaveCount(0)
  await visitorPage.goto(`/u/${handle}/list`)
  await expect(visitorPage.getByTestId('member-list-private')).toBeVisible()
  await visitor.close()

  // Le propriétaire, lui, garde accès à tout.
  await page.reload()
  await expect(page.getByTestId('profile-recent')).toBeVisible()

  // Sa liste est « Ma liste de lecture » : modifiable, même en passant par l'adresse du profil.
  await page.getByTestId('profile-list-link').click()
  await page.waitForURL('**/list')
  await expect(page.getByTestId('list-edit').first()).toBeVisible()
  await page.goto(`/u/${handle}/list?status=reading`)
  await page.waitForURL('**/list?status=reading')
  await expect(page.getByTestId('list-edit').first()).toBeVisible()
})

test('un membre inconnu donne la page 404', async ({ page }) => {
  const response = await page.goto('/u/personne-ici')

  expect(response?.status()).toBe(404)
})

test('le profil n’a aucun défaut d’accessibilité détectable', async ({ context, page }) => {
  const handle = await signUpWithList(context)
  await context.clearCookies()
  await page.goto(`/u/${handle}`)
  await page.waitForLoadState('networkidle')

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  expect(results.violations).toEqual([])
})
