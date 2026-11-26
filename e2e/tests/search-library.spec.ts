import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { waitForHydration } from '../support/hydration.js'
import { signUp } from '../support/session.js'

// Adding to the list from the search results: the API, the database, the session and the Nuxt
// relay are real, only Google is replaced. Same work as `library.spec.ts` (asserted nowhere else);
// its entries count as "members" of the work: one test at a time, then removal.
const WORK_ID = 5
const SEARCH_PATH = '/search?q=colportage'

test.use({ viewport: { width: 1280, height: 800 } })
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ context }) => {
  await context.request.delete(`/api/v1/works/${WORK_ID}/entry`)
})

async function openSearch(page: Page): Promise<void> {
  await page.goto(SEARCH_PATH)
  await waitForHydration(page)
  await expect(page.getByTestId('search-result')).toHaveCount(1)
}

const addButton = (page: Page) => page.getByTestId('result-add')
/** A work already in the list has no button: no "Add", no status, no waiting placeholder. */
async function expectListed(page: Page): Promise<void> {
  await expect(page.getByTestId('result-loading')).toHaveCount(0)
  await expect(addButton(page)).toHaveCount(0)
  await expect(page.getByTestId('search-result').getByRole('button')).toHaveCount(0)
}

/** Runs `action`, then waits for the write it sends: the screen changes before the answer. */
async function waitingForWrite(
  page: Page,
  method: 'PUT' | 'DELETE',
  action: () => Promise<void>,
): Promise<void> {
  const answered = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/works/${WORK_ID}/entry`) && response.request().method() === method,
  )
  await action()
  await answered
}

test('un visiteur voit « Ajouter », la connexion s’ouvre et ramène sur la recherche', async ({
  page,
}) => {
  await openSearch(page)
  await expect(addButton(page)).toBeEnabled()

  await addButton(page).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByTestId('sign-in-google')).toHaveAttribute(
    'href',
    `/api/v1/auth/google?returnTo=${encodeURIComponent(SEARCH_PATH)}`,
  )
})

test('ajouter depuis les résultats : le bouton disparaît et l’œuvre est dans la liste', async ({
  page,
  context,
}) => {
  await signUp(context)
  await openSearch(page)

  await waitingForWrite(page, 'PUT', () => addButton(page).click())

  await expectListed(page)
  await expect(page.getByTestId('toast')).toContainText('Œuvre ajoutée à ta liste.')
  await page.reload()
  await waitForHydration(page)
  await expectListed(page)
  const entry = await context.request.get(`/api/v1/works/${WORK_ID}/entry`)
  expect((await entry.json()).entry.status).toBe('plan_to_read')
})

test('une œuvre déjà dans la liste n’a pas de bouton', async ({ page, context }) => {
  await signUp(context)
  await context.request.put(`/api/v1/works/${WORK_ID}/entry`, { data: { status: 'reading' } })

  await openSearch(page)

  await expectListed(page)
})

test('un changement de filtre relit les statuts, sans « Ajouter » ni attente entre deux pages', async ({
  page,
  context,
}) => {
  await signUp(context)
  await context.request.put(`/api/v1/works/${WORK_ID}/entry`, { data: { status: 'reading' } })
  await openSearch(page)

  // Browser navigation: the list is read through the Nuxt relay, not by server rendering. It
  // arrives with the results, so neither the placeholder nor a false "Add" may show between pages.
  await page.evaluate(() => {
    const win = window as unknown as { placeholderShown: boolean }
    win.placeholderShown = false
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="result-loading"], [data-testid="result-add"]'))
        win.placeholderShown = true
    }).observe(document.body, { childList: true, subtree: true })
  })
  await page.getByRole('checkbox', { name: /One-shot/ }).check()

  await expect(page).toHaveURL(/type=oneshot/)
  await expectListed(page)
  expect(
    await page.evaluate(
      () => (window as unknown as { placeholderShown: boolean }).placeholderShown,
    ),
  ).toBe(false)
})

test('un visiteur qui se connecte retrouve l’œuvre ajoutée, avec « Annuler »', async ({
  page,
  context,
}) => {
  await openSearch(page)
  await addButton(page).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // The real sign-in goes through Google: open the session, then come back to the search.
  await signUp(context)
  await waitingForWrite(page, 'PUT', async () => {
    await page.goto(SEARCH_PATH)
    await waitForHydration(page)
  })

  await expectListed(page)
  await expect(page.getByTestId('toast')).toContainText('Œuvre ajoutée à ta liste.')

  await waitingForWrite(page, 'DELETE', () => page.getByTestId('toast-undo').click())
  await expect(addButton(page)).toBeVisible()
  const entry = await context.request.get(`/api/v1/works/${WORK_ID}/entry`)
  expect((await entry.json()).entry).toBeNull()
})

test('un visiteur qui ferme la fenêtre de connexion n’a pas d’ajout au retour', async ({
  page,
  context,
}) => {
  await openSearch(page)
  await addButton(page).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await signUp(context)
  await page.goto(SEARCH_PATH)
  await waitForHydration(page)

  await expect(addButton(page)).toBeVisible()
  await expect(page.getByTestId('toast')).toHaveCount(0)
})

test('l’ajout mémorisé ne se rejoue pas une seconde fois', async ({ page, context }) => {
  await openSearch(page)
  await addButton(page).click()
  await signUp(context)
  await waitingForWrite(page, 'PUT', async () => {
    await page.goto(SEARCH_PATH)
    await waitForHydration(page)
  })
  await expectListed(page)

  await context.request.delete(`/api/v1/works/${WORK_ID}/entry`)
  await page.reload()
  await waitForHydration(page)

  await expect(addButton(page)).toBeVisible()
})

test('un échec d’enregistrement annonce l’erreur et rend le bouton « Ajouter »', async ({
  page,
  context,
}) => {
  await signUp(context)
  await openSearch(page)
  await page.route(`**/api/v1/works/${WORK_ID}/entry`, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } })
      : route.continue(),
  )

  await addButton(page).click()

  await expect(page.getByTestId('toast')).toContainText("Impossible d'enregistrer")
  await expect(addButton(page)).toBeVisible()
})

test('la rangée reste accessible, avec « Ajouter » puis sans bouton', async ({ page, context }) => {
  await signUp(context)
  await openSearch(page)
  await expect(addButton(page)).toBeVisible()
  const withAdd = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(withAdd.violations).toEqual([])

  await waitingForWrite(page, 'PUT', () => addButton(page).click())
  await expectListed(page)
  const listed = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(listed.violations).toEqual([])
})

test.describe('mobile', () => {
  for (const width of [390, 320]) {
    test(`à ${width} px : étiquettes sur une seule ligne, sans défilement horizontal`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await signUp(context)
      await openSearch(page)

      for (const isListed of [false, true]) {
        if (isListed) {
          await waitingForWrite(page, 'PUT', () => addButton(page).click())
          await expectListed(page)
        }
        const tagHeights = await page
          .locator('.result__tag')
          .evaluateAll((tags) => tags.map((tag) => tag.getBoundingClientRect().height))
        expect(tagHeights.length).toBeGreaterThan(0)
        // One line only: "One-shot" is never split at its hyphen.
        expect(Math.max(...tagHeights)).toBeLessThan(30)
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        )
        expect(overflows).toBe(false)
      }
    })
  }
})
