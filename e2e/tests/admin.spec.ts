import { expect, test, type Page } from '@playwright/test'
import { signInAsAdmin } from '../support/admin.js'
import { waitForHydration } from '../support/hydration.js'
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

/** Publie une nouvelle fiche, après confirmation (ou enregistre une fiche publiée, sans bouton « Publier »). */
async function saveAndWaitForList(page: Page) {
  const publish = page.getByTestId('admin-publish')
  if ((await publish.count()) > 0) {
    await publish.click()
    await page.getByRole('dialog').getByTestId('confirm-accept').click()
  } else {
    await page.getByTestId('admin-save').click()
  }
  await expect(page).toHaveURL(LIST_URL)
}

/** Enregistre une nouvelle fiche en brouillon. */
async function saveDraftAndWaitForList(page: Page) {
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
  await waitForHydration(page)
  await page.getByTestId('admin-new').click()
  await waitForHydration(page)
  await page.locator('#person-name').fill(PERSON)
  await saveAndWaitForList(page)
  await expect(page.getByTestId('admin-row').filter({ hasText: PERSON })).toBeVisible()

  await page.goto('/admin/catalogue/publishers/new')
  await waitForHydration(page)
  await page.locator('#publisher-name').fill(PUBLISHER)
  await saveAndWaitForList(page)
  await expect(page).toHaveURL(/kind=publishers/)

  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)
  await page.locator('#work-title').fill(WORK)
  await page.getByTestId('pill-manga').click()
  await page.getByRole('combobox', { name: /^Langue originale/ }).click()
  await page.getByRole('option', { name: 'allemand (de)' }).click()
  // Publishing needs a synopsis in the original language, an author and a publisher.
  await page.getByRole('tab', { name: 'Titres et synopsis' }).click()
  const texts = page.locator('[role="tabpanel"]:visible')
  await texts.getByRole('button', { name: 'Ajouter une langue' }).click()
  await texts.getByRole('combobox', { name: /^Langue/ }).click()
  await page.getByRole('option', { name: 'allemand (de)' }).click()
  await texts.locator('textarea').fill('Eine Zusammenfassung.')
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
  const [work] = (await found.json()).items as {
    id: number
    mainAuthor: string | null
    originalLanguage: string
  }[]
  expect(work?.mainAuthor).toBe(PERSON)
  expect(work?.originalLanguage).toBe('de')
})

test('les formulaires marquent les champs obligatoires d’une étoile et l’expliquent', async ({
  page,
}) => {
  await page.goto('/admin/catalogue/people/new')
  await waitForHydration(page)
  const personForm = page.getByTestId('person-form')
  await expect(personForm.getByText('* champ obligatoire')).toBeVisible()
  await expect(personForm.locator('label[for="person-name"]')).toHaveText("Nom d'usage*")
  await expect(page.locator('#person-name')).toHaveAttribute('aria-required', 'true')
  await expect(personForm.getByRole('radiogroup')).toHaveCount(1)

  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)
  await expect(page.getByTestId('work-form').getByText('* champ obligatoire')).toBeVisible()
  await expect(page.locator('label[for="work-title"]')).toHaveText('Titre original*')
  await expect(page.locator('label[for="work-started"]')).not.toContainText('*')
  await expect(page.locator('#work-started')).not.toHaveAttribute('aria-required')
})

test('enregistrer une fiche d’œuvre vide met en avant les champs obligatoires', async ({
  page,
}) => {
  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)
  await expect(page.getByText('Champ obligatoire', { exact: true })).toHaveCount(0)

  await page.getByTestId('admin-publish').click()

  await expect(page).toHaveURL(/works\/new/)
  await expect(page.locator('#work-title')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Champ obligatoire', { exact: true })).toBeVisible()
  await expect(page.getByText('Choisis au moins un format.')).toBeVisible()
  await expect(
    page.getByRole('tab', { name: 'Informations' }).getByRole('img'),
  ).toHaveAccessibleName('Contient un champ obligatoire vide ou une ligne incomplète')

  await page.locator('#work-title').fill(`${WORK} complétée`)
  await page.getByTestId('pill-manga').click()
  await expect(page.getByText('Champ obligatoire', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Choisis au moins un format.')).toHaveCount(0)
})

test('une adresse qui n’est pas en https est refusée avec un message clair', async ({ page }) => {
  await page.goto('/admin/catalogue/publishers/new')
  await waitForHydration(page)
  await page.locator('#publisher-name').fill(`${PUBLISHER} adresse`)
  await page.locator('#publisher-url').fill('maison.test')

  await page.getByTestId('admin-save').click()

  await expect(page).toHaveURL(/publishers\/new/)
  await expect(page.locator('#publisher-url')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Adresse invalide', { exact: false })).toBeVisible()

  await page.locator('#publisher-url').fill('https://maison.test')
  await expect(page.locator('#publisher-url')).not.toHaveAttribute('aria-invalid')
})

test('une ligne existante sans champ obligatoire est signalée dans son onglet', async ({
  page,
}) => {
  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)
  await page.locator('#work-title').fill(`${WORK} lignes vides`)
  await page.getByTestId('pill-manga').click()
  await page.getByRole('tab', { name: 'Liens' }).click()
  await page.getByRole('button', { name: 'Ajouter un lien' }).click()

  await page.getByTestId('admin-publish').click()

  await expect(page).toHaveURL(/works\/new/)
  const alertLabel = 'Contient un champ obligatoire vide ou une ligne incomplète'
  await expect(page.getByRole('tab', { name: 'Liens' }).getByRole('img')).toHaveAccessibleName(
    alertLabel,
  )
  await expect(
    page.locator('[role="tabpanel"]:visible').getByText('Champ obligatoire', { exact: true }),
  ).toBeVisible()
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
  // La recherche s'applique après une pause : on l'attend, sinon elle écrase le filtre coché ensuite.
  await expect(page).not.toHaveURL(/q=/)
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
  await waitForHydration(page)
  await clickRowAction(page, 'edit')
  await expect(page).toHaveURL(/\/admin\/catalogue\/people\/\d+/)
  await waitForHydration(page)
  await page.getByTestId('admin-back').click()

  await expect(page).toHaveURL(/kind=people/)
  await expect(page).toHaveURL(/q=/)
  await expect(page.getByTestId('admin-search')).toHaveValue(PERSON)
})

test('quitter une fiche modifiée demande confirmation, et une fiche neuve repart vide', async ({
  page,
}) => {
  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)
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

test('retirer une ligne saisie demande confirmation, une ligne vide part tout de suite', async ({
  page,
}) => {
  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)
  await page.getByRole('tab', { name: 'Auteurs et éditeurs' }).click()
  const panel = page.locator('[role="tabpanel"]:visible')
  const rows = panel.getByTestId('row-list-row')
  // Chaque liste porte sa modale (fermée) : seule celle d'une ligne en cours de retrait est ouverte.
  const confirmation = page.locator('dialog[open]')

  await panel.getByRole('button', { name: 'Ajouter un auteur' }).click()
  await panel.getByRole('button', { name: 'Retirer cet auteur' }).click()
  await expect(rows).toHaveCount(0)
  await expect(confirmation).toBeHidden()

  await panel.getByRole('button', { name: 'Ajouter un auteur' }).click()
  await pickFirst(page, 'Mélodie Vasseur')
  await panel.getByRole('button', { name: 'Retirer cet auteur' }).click()
  await expect(confirmation).toBeVisible()

  await confirmation.getByTestId('confirm-cancel').click()
  await expect(rows).toHaveCount(1)

  await panel.getByRole('button', { name: 'Retirer cet auteur' }).click()
  await confirmation.getByTestId('confirm-accept').click()
  await expect(rows).toHaveCount(0)
})

test('un texte tapé sans choisir de proposition est refusé et la ligne est marquée', async ({
  page,
}) => {
  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)
  await page.locator('#work-title').fill(`${WORK} sans éditeur choisi`)
  await page.getByTestId('pill-manga').click()
  await page.getByRole('tab', { name: 'Auteurs et éditeurs' }).click()
  const panel = page.locator('[role="tabpanel"]:visible')
  await panel.getByRole('button', { name: 'Ajouter un éditeur' }).click()
  await panel.getByTestId('picker-input').fill('dd')
  await expect(panel.getByTestId('picker-error')).toHaveCount(0)

  await page.getByTestId('admin-publish').click()

  await expect(page.getByRole('alert').filter({ hasText: 'lignes incomplètes' })).toBeVisible()
  await expect(panel.getByTestId('picker-error')).toHaveText(
    'Choisis une proposition dans la liste.',
  )
  await expect(
    page.getByRole('tab', { name: 'Auteurs et éditeurs' }).getByRole('img'),
  ).toHaveAccessibleName('Contient un champ obligatoire vide ou une ligne incomplète')
  await expect(page).toHaveURL(/works\/new/)
})

test('enregistrer une fiche modifiée entre-temps est refusé', async ({ page, context }) => {
  const found = await context.request.get(`/api/v1/admin/works?q=${encodeURIComponent(WORK)}`)
  const [work] = (await found.json()).items as { id: number }[]
  const url = `/api/v1/admin/works/${work!.id}`
  await page.goto(`/admin/catalogue/works/${work!.id}`)
  await waitForHydration(page)

  // Une autre session enregistre la fiche pendant qu'elle est ouverte ici.
  const body = await (await context.request.get(url)).json()
  for (const readOnly of ['id', 'archived', 'draft', 'followerCount', 'labels'])
    delete body[readOnly]
  const other = await context.request.put(url, { data: body })
  expect(other.status()).toBe(200)

  await page.getByTestId('admin-save').click()
  await expect(page.getByRole('alert').filter({ hasText: 'modifiée depuis' })).toBeVisible()
  await expect(page.getByTestId('toast')).toHaveCount(0)
  await expect(page).toHaveURL(/\/admin\/catalogue\/works\/\d+$/)
})

test('archiver masque l’œuvre au public, restaurer la rend', async ({ page, context }) => {
  const found = await context.request.get(`/api/v1/works?q=${encodeURIComponent(WORK)}`)
  const [work] = (await found.json()).items as { id: number }[]
  const publicStatus = async () => (await context.request.get(`/api/v1/works/${work!.id}`)).status()
  expect(await publicStatus()).toBe(200)

  await page.goto(`/admin/catalogue/works/${work!.id}`)
  await waitForHydration(page)
  await expect(page.getByTestId('admin-state')).toHaveText('Publiée')
  await page.getByTestId('admin-archive').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()
  await expect(page).toHaveURL(LIST_URL)
  expect(await publicStatus()).toBe(404)

  await page.goto(`/admin/catalogue?q=${encodeURIComponent(WORK)}`)
  await expect(page.getByTestId('admin-row')).toHaveCount(0)
  await page.goto(`/admin/catalogue?q=${encodeURIComponent(WORK)}&scope=archived`)
  await waitForHydration(page)
  await expect(page.getByTestId('admin-row')).toContainText('par @')
  await clickRowAction(page, 'restore')
  await expect(page.getByTestId('admin-row')).toHaveCount(0)
  expect(await publicStatus()).toBe(200)
})

test('une personne créditée sur une œuvre publiée ne s’archive pas', async ({ page, context }) => {
  const found = await context.request.get(`/api/v1/admin/people?q=${encodeURIComponent(PERSON)}`)
  const [person] = (await found.json()).items as { id: number }[]

  await page.goto(`/admin/catalogue/people/${person!.id}`)
  await waitForHydration(page)
  await page.getByTestId('admin-archive').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()

  await expect(page.getByRole('alert').filter({ hasText: 'encore créditée' })).toBeVisible()
  await expect(page.getByTestId('toast')).toHaveCount(0)
  await expect(page.getByTestId('admin-state')).toHaveText('Publiée')
})

test('se déconnecter depuis une page d’administration ramène à l’accueil', async ({ page }) => {
  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)

  await page.getByTestId('account-menu').click()
  await page.getByTestId('sign-out').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('sign-in')).toBeVisible()
  await expect(page.getByTestId('auth-notice')).toContainText('Tu es déconnecté')
})

test('se déconnecter avec une fiche modifiée demande d’abord de quitter, puis de se déconnecter', async ({
  page,
}) => {
  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)
  await page.locator('#work-title').fill(`${WORK} non enregistrée`)

  await page.getByTestId('account-menu').click()
  await page.getByTestId('sign-out').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Quitter sans enregistrer ?')
  await dialog.getByTestId('confirm-accept').click()
  await expect(dialog).toContainText('Se déconnecter ?')
  await dialog.getByTestId('confirm-accept').click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('sign-in')).toBeVisible()
  await expect(page.getByTestId('leave-confirm')).toHaveCount(0)
})

test('rester sur la fiche annule la déconnexion, sans seconde fenêtre', async ({ page }) => {
  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)
  await page.locator('#work-title').fill(`${WORK} gardée`)

  await page.getByTestId('account-menu').click()
  await page.getByTestId('sign-out').click()
  await page.getByRole('dialog').getByTestId('confirm-cancel').click()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('account-menu')).toBeVisible()
  await expect(page.locator('#work-title')).toHaveValue(`${WORK} gardée`)
})

const DRAFT = `Brouillon E2E ${SUFFIX}`

test('un brouillon n’exige que son titre, reste invisible du public puis se publie', async ({
  page,
  context,
}) => {
  await page.goto('/admin/catalogue/works/new')
  await waitForHydration(page)

  // Sans titre : seul le titre est signalé, pas le format.
  await page.getByTestId('admin-save').click()
  await expect(page.locator('#work-title')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Choisis au moins un format.')).toHaveCount(0)

  // Avec le seul titre : enregistré en brouillon.
  await page.locator('#work-title').fill(DRAFT)
  await saveDraftAndWaitForList(page)
  const found = await context.request.get(`/api/v1/admin/works?q=${encodeURIComponent(DRAFT)}`)
  const [work] = (await found.json()).items as { id: number; draft: boolean }[]
  expect(work!.draft).toBe(true)
  expect((await context.request.get(`/api/v1/works/${work!.id}`)).status()).toBe(404)

  // La liste le met en avant, et le filtre d'état le retrouve.
  await page.goto(`/admin/catalogue?q=${encodeURIComponent(DRAFT)}&state=draft`)
  await waitForHydration(page)
  await expect(page.getByTestId('admin-row').getByTestId('admin-draft')).toHaveText('Brouillon')

  // Un auteur, un éditeur et un synopsis sont déjà saisis (par l'API, pour aller à l'essentiel).
  const first = async (path: string, name: string) =>
    (
      (
        await (
          await context.request.get(`/api/v1/admin/${path}?q=${encodeURIComponent(name)}`)
        ).json()
      ).items as { id: number }[]
    )[0]!.id
  const url = `/api/v1/admin/works/${work!.id}`
  const body = await (await context.request.get(url)).json()
  for (const readOnly of ['id', 'archived', 'draft', 'followerCount', 'labels'])
    delete body[readOnly]
  const complete = await context.request.put(url, {
    data: {
      ...body,
      credits: [{ personId: await first('people', PERSON), role: 'story' }],
      publisherIds: [await first('publishers', PUBLISHER)],
      synopses: [{ language: 'fr', text: 'Un résumé.', source: 'official' }],
    },
  })
  expect(complete.status()).toBe(200)

  // Publier sans format est refusé ; avec un format et après confirmation, la fiche devient publique.
  await page.goto(`/admin/catalogue?q=${encodeURIComponent(DRAFT)}&state=draft`)
  await waitForHydration(page)
  await clickRowAction(page, 'edit')
  await waitForHydration(page)
  await expect(page.getByTestId('draft-banner')).toBeVisible()
  await page.getByTestId('admin-publish').click()
  await expect(page.getByText('Choisis au moins un format.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByTestId('pill-manga').click()
  await page.getByTestId('admin-publish').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()
  await expect(page).toHaveURL(LIST_URL)
  expect((await context.request.get(`/api/v1/works/${work!.id}`)).status()).toBe(200)
})

test('un brouillon se supprime définitivement, une fiche publiée non', async ({
  page,
  context,
}) => {
  const created = await context.request.post('/api/v1/admin/people', {
    data: { name: `${DRAFT} personne`, kind: 'person', published: false },
  })
  const person = (await created.json()) as { id: number }

  await page.goto(`/admin/catalogue/people/${person.id}`)
  await waitForHydration(page)
  await expect(page.getByTestId('admin-state')).toHaveText('Brouillon')
  await page.getByTestId('admin-delete-draft').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()
  await expect(page).toHaveURL(LIST_URL)
  expect((await context.request.get(`/api/v1/admin/people/${person.id}`)).status()).toBe(404)
})

test('une fiche archivée se supprime définitivement depuis la liste des archives', async ({
  page,
  context,
}) => {
  const created = await context.request.post('/api/v1/admin/people', {
    data: { name: `${DRAFT} archivée`, kind: 'person' },
  })
  const person = (await created.json()) as { id: number }
  expect((await context.request.post(`/api/v1/admin/people/${person.id}/archive`)).status()).toBe(
    200,
  )

  await page.goto(`/admin/catalogue?scope=archived&kind=people&q=${encodeURIComponent(DRAFT)}`)
  await waitForHydration(page)
  const row = page.getByTestId('admin-row').filter({ hasText: `${DRAFT} archivée` })
  await row.getByTestId('admin-row-menu').click()
  if (isMobile(page)) {
    // Écran étroit : la feuille du bas, qui porte aussi « Restaurer ».
    await page.getByTestId('admin-menu-remove').click()
  } else {
    await expect(row.getByTestId('admin-restore')).toBeVisible()
    await expect(page.getByRole('menuitem')).toHaveCount(1)
    await expect(page.getByRole('menuitem')).toBeFocused()
    await page.getByTestId('admin-dropdown-remove').click()
  }
  await page.getByRole('dialog').getByTestId('confirm-accept').click()

  await expect(row).toHaveCount(0)
  expect((await context.request.get(`/api/v1/admin/people/${person.id}`)).status()).toBe(404)
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

test('le bandeau des brouillons mène à la liste du type choisi', async ({ page, context }) => {
  const created = await context.request.post('/api/v1/admin/people', {
    data: { name: `${DRAFT} bandeau`, kind: 'person', published: false },
  })
  expect(created.status()).toBe(201)

  await page.goto('/admin/catalogue')
  await waitForHydration(page)
  await expect(page.getByTestId('admin-drafts')).toContainText('à terminer')
  await page.getByTestId('admin-show-drafts-people').click()

  await expect(page).toHaveURL(/kind=people&state=draft|state=draft&kind=people/)
  await expect(page.getByTestId('admin-row').filter({ hasText: `${DRAFT} bandeau` })).toBeVisible()
})

test('une panne d’enregistrement s’annonce avec « Réessayer », qui rejoue l’envoi', async ({
  page,
  context,
}) => {
  const created = await context.request.post('/api/v1/admin/people', {
    data: { name: `${DRAFT} panne`, kind: 'person', published: false },
  })
  const person = (await created.json()) as { id: number }
  await page.goto(`/admin/catalogue/people/${person.id}`)
  await waitForHydration(page)

  let failed = false
  await page.route(`**/api/v1/admin/people/${person.id}`, (route) => {
    if (route.request().method() !== 'PUT' || failed) return route.continue()
    failed = true
    return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', message: 'simulated' } })
  })
  await page.getByTestId('admin-save').click()
  await expect(page.getByTestId('toast')).toContainText("Impossible d'enregistrer")
  await expect(page).toHaveURL(new RegExp(`people/${person.id}$`))

  await page.getByTestId('toast-retry').click()
  await expect(page).toHaveURL(LIST_URL)
})

test('le refus de supprimer un brouillon cité s’affiche à l’écran, sans défiler', async ({
  page,
  context,
}) => {
  const created = await context.request.post('/api/v1/admin/people', {
    data: { name: `${DRAFT} citée`, kind: 'person', published: false },
  })
  const person = (await created.json()) as { id: number }
  const work = await context.request.post('/api/v1/admin/works', {
    data: {
      title: `${DRAFT} citant`,
      originalLanguage: 'fr',
      type: 'oneshot',
      status: 'completed',
      chapters: null,
      volumes: 1,
      startedOn: null,
      endedOn: null,
      credits: [{ personId: person.id, role: 'story' }],
      published: false,
    },
  })
  expect(work.status()).toBe(201)

  await page.setViewportSize({ width: 1280, height: 360 })
  await page.goto(`/admin/catalogue/people/${person.id}`)
  await waitForHydration(page)
  await page.getByTestId('admin-delete-draft').click()
  await page.getByRole('dialog').getByTestId('confirm-accept').click()

  const refusal = page.getByRole('alert').filter({ hasText: 'encore cité' })
  await expect(refusal).toBeVisible()
  await expect(refusal).toBeInViewport()
  await expect(page.getByTestId('toast')).toHaveCount(0)
})
