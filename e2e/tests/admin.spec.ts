import { expect, test, type Page } from '@playwright/test'
import { signInAsAdmin } from '../support/admin.js'
import { signUp } from '../support/session.js'

// Administration du catalogue (US-11) : l'API, la base, la session et le relais Nuxt sont réels ;
// seul Google est remplacé. Le compte administrateur est celui du jeu de démo ; les fiches créées
// ici portent un suffixe propre à l'exécution.
test.describe.configure({ mode: 'serial' })

/** La liste du catalogue, avec ou sans paramètres (et non une fiche : `/admin/catalogue/works/1`). */
const LIST_URL = /\/admin\/catalogue(\?.*)?$/

const SUFFIX = crypto.randomUUID().slice(0, 8)
const PERSON = `Auteure E2E ${SUFFIX}`
const PUBLISHER = `Maison E2E ${SUFFIX}`
const WORK = `Œuvre E2E ${SUFFIX}`

test.beforeEach(async ({ context }) => {
  await signInAsAdmin(context)
})

async function saveAndWaitForList(page: Page) {
  await page.getByTestId('admin-save').click()
  await expect(page).toHaveURL(LIST_URL)
}

// Sous 768 px, la liste n'a plus de bouton « Modifier » ni « Restaurer » : « ⋮ » ouvre une feuille.
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768

/** Modifie ou restaure l'unique fiche de la liste, au bureau comme au mobile. */
async function clickRowAction(page: Page, action: 'edit' | 'restore') {
  if (isMobile(page)) {
    await page.getByTestId('admin-row-menu').click()
    await page.getByTestId(`admin-menu-${action}`).click()
  } else {
    await page.getByTestId(`admin-${action}`).click()
  }
}

/** Choisit le premier résultat d'un sélecteur de la section visible. */
async function pickFirst(page: Page, search: string) {
  const panel = page.locator('[role="tabpanel"]:visible')
  await panel.getByTestId('picker-input').last().fill(search)
  await panel.getByTestId('picker-results').last().getByRole('button').first().click()
}

test('un administrateur crée une personne, un éditeur et une œuvre qui les cite', async ({
  page,
  context,
}) => {
  // Sans attendre l'hydratation, un clic ou un enregistrement partirait en navigation ou en envoi natif.
  await page.goto('/admin/catalogue?kind=people')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('admin-new').click()
  await page.waitForLoadState('networkidle')
  await page.locator('#person-name').fill(PERSON)
  await saveAndWaitForList(page)
  await expect(page.getByTestId('admin-row').filter({ hasText: PERSON })).toBeVisible()

  await page.goto('/admin/catalogue/publishers/new')
  await page.waitForLoadState('networkidle')
  await page.locator('#publisher-name').fill(PUBLISHER)
  await saveAndWaitForList(page)
  await expect(page).toHaveURL(/kind=publishers/)

  await page.goto('/admin/catalogue/works/new')
  await page.waitForLoadState('networkidle')
  await page.locator('#work-title').fill(WORK)
  await page.getByRole('tab', { name: 'Auteurs et éditeurs' }).click()
  const panel = page.locator('[role="tabpanel"]:visible')
  await panel.getByRole('button', { name: 'Ajouter un auteur' }).click()
  await pickFirst(page, PERSON)
  await panel.getByRole('button', { name: 'Ajouter un éditeur' }).click()
  await pickFirst(page, PUBLISHER)
  await saveAndWaitForList(page)

  await page.goto(`/admin/catalogue?q=${encodeURIComponent(WORK)}`)
  await expect(page.getByTestId('admin-row').filter({ hasText: WORK })).toBeVisible()

  const found = await context.request.get(`/api/v1/works?q=${encodeURIComponent(WORK)}`)
  const [work] = (await found.json()).items as { id: number; mainAuthor: string | null }[]
  expect(work?.mainAuthor).toBe(PERSON)
})

test('les filtres et le tri de la liste des œuvres se combinent', async ({ page }) => {
  const author = encodeURIComponent(PERSON)
  const rows = page.getByTestId('admin-row')

  // La recherche d'une œuvre trouve aussi par le nom de son auteur.
  await page.goto(`/admin/catalogue?q=${author}`)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(WORK)

  await page.goto(`/admin/catalogue?q=${author}&type=oneshot`)
  await expect(rows).toHaveCount(0)

  await page.goto(`/admin/catalogue?q=${author}&type=oneshot,series`)
  await expect(rows).toHaveCount(1)

  await page.goto(`/admin/catalogue?q=${author}&sort=completeness_desc`)
  await expect(rows).toHaveCount(1)
  await page.getByTestId('admin-search').fill('')
  // Au mobile, les filtres sont dans la feuille « Filtres » ; au bureau, dans la barre.
  if (isMobile(page)) {
    await page.getByTestId('filters-open').click()
    await page.getByTestId('sheet-type-oneshot').check()
    await expect(page).toHaveURL(/type=oneshot/)
    await page.getByTestId('filters-sheet-reset').click()
  } else {
    await page.getByTestId('filter-type').click()
    await page.getByTestId('filter-type-oneshot').check()
    await expect(page).toHaveURL(/type=oneshot/)
    await page.getByTestId('filter-reset').click()
  }
  await expect(page).not.toHaveURL(/type=/)
  await expect.poll(() => rows.count()).toBeGreaterThan(1)
})

test('revenir d’une fiche garde l’onglet et la recherche de la liste', async ({ page }) => {
  await page.goto(`/admin/catalogue?kind=people&q=${encodeURIComponent(PERSON)}`)
  await clickRowAction(page, 'edit')
  await expect(page).toHaveURL(/\/admin\/catalogue\/people\/\d+/)
  await page.getByTestId('admin-back').click()

  await expect(page).toHaveURL(/kind=people/)
  await expect(page).toHaveURL(/q=/)
  await expect(page.getByTestId('admin-search')).toHaveValue(PERSON)
})

test('quitter une fiche modifiée demande confirmation, et une fiche neuve repart vide', async ({
  page,
}) => {
  await page.goto('/admin/catalogue/works/new')
  await page.waitForLoadState('networkidle')
  await page.locator('#work-title').fill(`${WORK} abandonnée`)
  await page.getByTestId('admin-cancel').click()
  const leave = page.getByTestId('leave-confirm')
  await expect(leave).toBeVisible()

  await leave.getByTestId('confirm-cancel').click()
  await expect(page).toHaveURL(/works\/new/)
  await expect(page.locator('#work-title')).toHaveValue(`${WORK} abandonnée`)

  await page.getByTestId('admin-cancel').click()
  await leave.getByTestId('confirm-accept').click()
  await expect(page).toHaveURL(LIST_URL)

  await page.getByTestId('admin-new').click()
  await expect(page.locator('#work-title')).toHaveValue('')
})

test('enregistrer une fiche modifiée entre-temps est refusé', async ({ page, context }) => {
  const found = await context.request.get(`/api/v1/admin/works?q=${encodeURIComponent(WORK)}`)
  const [work] = (await found.json()).items as { id: number }[]
  const url = `/api/v1/admin/works/${work!.id}`
  await page.goto(`/admin/catalogue/works/${work!.id}`)
  await page.waitForLoadState('networkidle')

  // Une autre session enregistre la fiche pendant qu'elle est ouverte ici.
  const body = await (await context.request.get(url)).json()
  for (const readOnly of ['id', 'archived', 'followerCount']) delete body[readOnly]
  const other = await context.request.put(url, { data: body })
  expect(other.status()).toBe(200)

  await page.getByTestId('admin-save').click()
  await expect(page.getByRole('alert')).toContainText('modifiée depuis')
  await expect(page).toHaveURL(/\/admin\/catalogue\/works\/\d+$/)
})

test('archiver masque l’œuvre au public, restaurer la rend', async ({ page, context }) => {
  const found = await context.request.get(`/api/v1/works?q=${encodeURIComponent(WORK)}`)
  const [work] = (await found.json()).items as { id: number }[]
  const publicStatus = async () => (await context.request.get(`/api/v1/works/${work!.id}`)).status()
  expect(await publicStatus()).toBe(200)

  await page.goto(`/admin/catalogue/works/${work!.id}`)
  await expect(page.getByTestId('admin-state')).toHaveText('Publiée')
  await page.getByTestId('admin-archive').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()
  await expect(page).toHaveURL(LIST_URL)
  expect(await publicStatus()).toBe(404)

  await page.goto(`/admin/catalogue?q=${encodeURIComponent(WORK)}`)
  await expect(page.getByTestId('admin-row')).toHaveCount(0)
  await page.goto(`/admin/catalogue?q=${encodeURIComponent(WORK)}&scope=archived`)
  await expect(page.getByTestId('admin-row')).toContainText('par @')
  await clickRowAction(page, 'restore')
  await expect(page.getByTestId('admin-row')).toHaveCount(0)
  expect(await publicStatus()).toBe(200)
})

test('une personne créditée sur une œuvre publiée ne s’archive pas', async ({ page, context }) => {
  const found = await context.request.get(`/api/v1/admin/people?q=${encodeURIComponent(PERSON)}`)
  const [person] = (await found.json()).items as { id: number }[]

  await page.goto(`/admin/catalogue/people/${person!.id}`)
  await page.getByTestId('admin-archive').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()

  await expect(page.getByRole('alert')).toContainText('encore créditée')
  await expect(page.getByTestId('admin-state')).toHaveText('Publiée')
})

test('se déconnecter depuis une page d’administration ramène à l’accueil', async ({ page }) => {
  await page.goto('/admin/catalogue/works/new')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('account-menu').click()
  await page.getByTestId('sign-out').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('sign-in')).toBeVisible()
  await expect(page.getByTestId('auth-notice')).toContainText('Tu es déconnecté')
})

test('un membre simple voit une 404, un visiteur revient à l’accueil', async ({ browser }) => {
  const { baseURL } = test.info().project.use
  const member = await browser.newContext({ baseURL })
  await signUp(member)
  const memberPage = await member.newPage()
  const response = await memberPage.goto('/admin/catalogue')
  expect(response?.status()).toBe(404)
  await member.close()

  const visitor = await browser.newContext({ baseURL })
  const visitorPage = await visitor.newPage()
  await visitorPage.goto('/admin/catalogue')
  await expect(visitorPage).toHaveURL(/\/$/)
  await visitor.close()
})
