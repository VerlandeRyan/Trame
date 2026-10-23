import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signUp, uniqueHandle } from '../support/session.js'

// Fiche de lecture (US-05, US-06) : l'API, la base, la session et le relais Nuxt sont réels ;
// seul Google est remplacé (voir `auth.spec.ts`). Œuvre de démo : 1 tome, nombre de chapitres inconnu.
// Une œuvre que les autres parcours n'assertent pas (« Membres 1 » de la fiche n° 1, « À la une »).
const WORK_ID = 5
const WORK_PATH = `/work/${WORK_ID}-carnet-de-colportage`
const MAX_HANDLE_LENGTH = 30

// Les entrées créées ici comptent comme « membres » de l'œuvre : un test à la fois, puis retrait.
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ context }) => {
  await context.request.delete(`/api/v1/works/${WORK_ID}/entry`)
})

async function openWork(page: Page): Promise<void> {
  await page.goto(WORK_PATH)
  // La fiche de lecture se charge dans le navigateur, une fois la page hydratée.
  await page.waitForLoadState('networkidle')
}

const statusButton = (page: Page) => page.getByTestId('library-status')
const statusMenu = (page: Page) => page.getByTestId('library-status-menu')
const chaptersField = (page: Page) =>
  page.getByRole('textbox', { name: 'Chapitres lus', exact: true })
const volumesField = (page: Page) => page.getByRole('textbox', { name: 'Tomes lus', exact: true })
const ratingField = (page: Page) => page.getByRole('textbox', { name: 'Ma note', exact: true })

async function addToList(page: Page): Promise<void> {
  await page.getByTestId('library-add').click()
  await expect(statusButton(page)).toBeVisible()
}

async function chooseStatus(page: Page, status: string): Promise<void> {
  await statusButton(page).click()
  await page.getByTestId(`library-status-${status}`).click()
}

async function top(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox()
  return box?.y ?? Number.NaN
}

test('un visiteur voit « Ajouter à ma liste » et la fenêtre de connexion s’ouvre', async ({
  page,
}) => {
  await openWork(page)

  await page.getByTestId('library-sign-in').click()

  await expect(page.getByRole('dialog')).toBeVisible()
})

test('ajouter une œuvre, la faire avancer, la noter, la dater, puis la retirer', async ({
  page,
  context,
}) => {
  await signUp(context)
  await openWork(page)

  await addToList(page)
  await expect(statusButton(page)).toContainText('À lire')
  await expect(ratingField(page)).toHaveValue('—')

  // Les deux compteurs sont indépendants : l'un ne bouge jamais l'autre.
  await page.getByRole('button', { name: 'Augmenter : Chapitres lus' }).click()
  // Un chapitre de plus sur une œuvre « À lire » : on demande avant de la passer en « En cours ».
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(statusButton(page)).toContainText('À lire')
  await page.getByRole('dialog').getByTestId('confirm-accept').click()
  await expect(statusButton(page)).toContainText('En cours')
  await expect(chaptersField(page)).toHaveValue('1')
  // Le premier tome atteint le total connu (1) : on propose « Terminé », on garde « En cours ».
  await page.getByRole('button', { name: 'Augmenter : Tomes lus' }).click()
  await page.getByRole('dialog').getByTestId('confirm-cancel').click()
  await page.getByRole('button', { name: 'Augmenter : Tomes lus' }).click()
  await expect(volumesField(page)).toHaveValue('2')
  await expect(chaptersField(page)).toHaveValue('1')

  // En cours : la date de début est proposée.
  await chooseStatus(page, 'reading')
  await expect(statusButton(page)).toContainText('En cours')
  await expect(page.getByTestId('library-started')).not.toHaveValue('')

  await ratingField(page).fill('8')
  await ratingField(page).blur()
  await expect(ratingField(page)).toHaveValue('8')

  await page.getByTestId('library-dates-toggle').click()
  await page.getByTestId('library-finished').fill('2026-03-04')

  // Tout est enregistré : rechargée, la fiche retrouve ses valeurs.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(statusButton(page)).toContainText('En cours')
  await expect(chaptersField(page)).toHaveValue('1')
  await expect(volumesField(page)).toHaveValue('2')
  await expect(ratingField(page)).toHaveValue('8')
  await expect(page.getByTestId('library-finished')).toHaveValue('2026-03-04')

  // Retirer de la liste : dernière entrée du menu de statut, avec confirmation.
  await statusButton(page).click()
  await page.getByTestId('library-remove').click()
  await statusMenu(page).getByTestId('confirm-accept').click()
  await expect(page.getByTestId('library-add')).toBeVisible()
  await expect(page.getByTestId('library-progress')).toBeHidden()
})

test('garder l’œuvre quand on annule le retrait', async ({ page, context }) => {
  await signUp(context)
  await openWork(page)
  await addToList(page)

  await statusButton(page).click()
  await page.getByTestId('library-remove').click()
  await statusMenu(page).getByTestId('confirm-cancel').click()

  await expect(statusButton(page)).toBeVisible()
})

test('le bouton de statut prend la couleur du statut', async ({ page, context }) => {
  await signUp(context)
  await openWork(page)
  await addToList(page)
  await chooseStatus(page, 'reading')

  // `--status-reading` : #4cc38a.
  await expect(statusButton(page)).toHaveCSS('background-color', 'rgb(76, 195, 138)')
})

// Annuler, fermer par la croix, par Échap ou en cliquant à côté : rien n'est enregistré.
for (const [label, dismiss] of [
  ['Annuler', (page: Page) => page.getByRole('dialog').getByTestId('confirm-cancel').click()],
  ['la croix', (page: Page) => page.getByRole('button', { name: 'Fermer' }).click()],
  ['Échap', (page: Page) => page.keyboard.press('Escape')],
  ['un clic à côté', (page: Page) => page.mouse.click(5, 5)],
] as const) {
  test(`${label} : ni le compteur ni le statut ne changent`, async ({ page, context }) => {
    await signUp(context)
    await openWork(page)
    await addToList(page)

    await page.getByRole('button', { name: 'Augmenter : Chapitres lus' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await dismiss(page)
    await expect(page.getByRole('dialog')).toBeHidden()

    await expect(statusButton(page)).toContainText('À lire')
    await expect(chaptersField(page)).toHaveValue('0')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(statusButton(page)).toContainText('À lire')
    await expect(chaptersField(page)).toHaveValue('0')
  })
}

for (const [status, label] of [
  ['on_hold', 'En pause'],
  ['dropped', 'Abandonné'],
] as const) {
  test(`une œuvre « ${label} » demande si on reprend la lecture`, async ({ page, context }) => {
    await signUp(context)
    await openWork(page)
    await addToList(page)
    await chooseStatus(page, status)
    await expect(statusButton(page)).toContainText(label)

    await page.getByRole('button', { name: 'Augmenter : Chapitres lus' }).click()
    await expect(page.getByRole('dialog')).toContainText('Reprendre la lecture ?')
    await page.getByRole('dialog').getByTestId('confirm-accept').click()

    await expect(statusButton(page)).toContainText('En cours')
    await expect(chaptersField(page)).toHaveValue('1')
  })
}

// Le total connu (ici 1 tome) est atteint : on propose « Terminé ».
test.describe('total connu atteint', () => {
  test('confirmer passe en « Terminé » et propose la date de fin', async ({ page, context }) => {
    await signUp(context)
    await openWork(page)
    await addToList(page)
    await chooseStatus(page, 'reading')

    await page.getByRole('button', { name: 'Augmenter : Tomes lus' }).click()
    await expect(page.getByRole('dialog')).toContainText('Tu as fini cette œuvre ?')
    await expect(page.getByRole('dialog')).toContainText('Tu as lu le tome paru')
    await page.getByRole('dialog').getByTestId('confirm-accept').click()

    await expect(statusButton(page)).toContainText('Terminé')
    await expect(volumesField(page)).toHaveValue('1')
    await expect(page.getByTestId('library-finished')).not.toHaveValue('')
  })

  test('« Garder » enregistre le compteur sans changer le statut', async ({ page, context }) => {
    await signUp(context)
    await openWork(page)
    await addToList(page)
    await chooseStatus(page, 'reading')

    await page.getByRole('button', { name: 'Augmenter : Tomes lus' }).click()
    await page.getByRole('dialog').getByTestId('confirm-cancel').click()

    await expect(statusButton(page)).toContainText('En cours')
    await expect(volumesField(page)).toHaveValue('1')
  })

  test('fermer par Échap n’enregistre rien', async ({ page, context }) => {
    await signUp(context)
    await openWork(page)
    await addToList(page)
    await chooseStatus(page, 'reading')

    await page.getByRole('button', { name: 'Augmenter : Tomes lus' }).click()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(statusButton(page)).toContainText('En cours')
    await expect(volumesField(page)).toHaveValue('0')
  })
})

// Passer en « Terminé » avec un compteur sous le total connu (1 tome) propose de l'y mettre.
test.describe('passage en « Terminé » avec un total connu', () => {
  test('confirmer met le compteur au total paru', async ({ page, context }) => {
    await signUp(context)
    await openWork(page)
    await addToList(page)

    await chooseStatus(page, 'completed')
    await expect(page.getByRole('dialog')).toContainText('Compteurs au total')
    await expect(page.getByRole('dialog')).toContainText('Mettre tes tomes lus à 1')
    await page.getByRole('dialog').getByTestId('confirm-accept').click()

    await expect(statusButton(page)).toContainText('Terminé')
    await expect(volumesField(page)).toHaveValue('1')
  })

  test('« Garder mes compteurs » enregistre le statut seul', async ({ page, context }) => {
    await signUp(context)
    await openWork(page)
    await addToList(page)

    await chooseStatus(page, 'completed')
    await page.getByRole('dialog').getByTestId('confirm-cancel').click()

    await expect(statusButton(page)).toContainText('Terminé')
    await expect(volumesField(page)).toHaveValue('0')
  })

  test('la croix n’enregistre rien', async ({ page, context }) => {
    await signUp(context)
    await openWork(page)
    await addToList(page)

    await chooseStatus(page, 'completed')
    await page.keyboard.press('Escape')

    await expect(statusButton(page)).toContainText('À lire')
    await expect(volumesField(page)).toHaveValue('0')
  })
})

test('au rechargement, la page arrive déjà dans l’état de ma liste, sans « Ajouter » ni attente', async ({
  page,
  context,
}) => {
  await signUp(context)
  await openWork(page)
  await addToList(page)
  await chooseStatus(page, 'on_hold')
  await expect(statusButton(page)).toContainText('En pause')

  // Le HTML reçu du serveur (avant tout JavaScript) porte déjà le statut.
  const html = await (await context.request.get(WORK_PATH)).text()
  expect(html).toContain('data-testid="library-status"')
  expect(html).not.toContain('data-testid="library-add"')
  expect(html).not.toContain('data-testid="library-loading"')
  expect(html).toContain('data-testid="library-progress"')
})

test('avertit sans bloquer quand on dépasse le nombre de tomes connus', async ({
  page,
  context,
}) => {
  await signUp(context)
  await openWork(page)
  await addToList(page)
  await chooseStatus(page, 'reading')

  await volumesField(page).fill('5')
  await volumesField(page).blur()
  // Dépasser le total connu propose aussi « Terminé » : on garde le statut.
  await page.getByRole('dialog').getByTestId('confirm-cancel').click()

  await expect(page.getByTestId('library-warning')).toContainText('1 tome')
  await expect(volumesField(page)).toHaveValue('5')
})

test.describe('place des blocs, d’après les maquettes', () => {
  test('bureau : le statut est dans la colonne de gauche, la progression suit la note', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await signUp(context)
    await openWork(page)
    await addToList(page)

    const status = await statusButton(page).boundingBox()
    const progress = await page.getByTestId('library-progress').boundingBox()
    expect(status?.x).toBeLessThan(progress?.x ?? 0)
    expect(await top(page, 'work-rating')).toBeLessThan(await top(page, 'library-progress'))
  })

  test('mobile : le statut sous le titre, puis la progression avant la note', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await signUp(context)
    await openWork(page)
    await addToList(page)

    expect(await top(page, 'work-title')).toBeLessThan(await top(page, 'library-status'))
    expect(await top(page, 'library-status')).toBeLessThan(await top(page, 'library-progress'))
    expect(await top(page, 'library-progress')).toBeLessThan(await top(page, 'work-rating'))
  })

  // Un panneau trop haut repoussait le synopsis hors de l'écran : trois colonnes côte à côte,
  // dates repliées, comme les maquettes.
  for (const width of [320, 390]) {
    test(`${width} px : « Ma progression » reste compacte, en trois colonnes`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await signUp(context)
      await openWork(page)
      await addToList(page)

      const panel = await page.getByTestId('library-progress').boundingBox()
      expect(panel?.height).toBeLessThanOrEqual(170)
      const tops = await Promise.all(
        [chaptersField, volumesField, ratingField].map(
          async (field) => (await field(page).boundingBox())?.y,
        ),
      )
      expect(new Set(tops).size).toBe(1)
      await expect(page.getByTestId('library-started')).toBeHidden()
    })
  }
})

test.describe('accessibilité et mobile', () => {
  test('fiche de lecture remplie, menu ouvert : aucune violation axe', async ({
    page,
    context,
  }) => {
    await signUp(context)
    await openWork(page)
    await addToList(page)
    await statusButton(page).click()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  test('pas de défilement horizontal à 320 px, pseudo de 30 caractères', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await signUp(context, uniqueHandle(MAX_HANDLE_LENGTH))
    await openWork(page)
    await addToList(page)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
