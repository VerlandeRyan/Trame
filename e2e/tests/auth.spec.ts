import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// Connexion : l'API, la base, les sessions, le cookie et le relais Nuxt sont réels ; seul Google est
// remplacé (`api/src/e2e/fake-google.ts`). Le contrôle avec un vrai Google reste manuel.
const WORK_PATH = '/work/1-les-lanternes-de-brume'

function uniqueHandle(prefix = 'lecteur'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/** Fait le trajet de Google à la main : renvoie la session « pseudo à choisir » ou « connectée ». */
async function signInWithGoogleAs(context: BrowserContext, sub: string): Promise<void> {
  const start = await context.request.get('/api/v1/auth/google?returnTo=%2F', { maxRedirects: 0 })
  const state = new URL(start.headers().location ?? '').searchParams.get('state') as string
  const code = encodeURIComponent(`e2e:${sub}:${sub}@example.test`)
  const callback = await context.request.get(
    `/api/v1/auth/google/callback?code=${code}&state=${state}`,
    { maxRedirects: 0 },
  )
  expect(callback.status()).toBe(302)
}

async function openSignIn(page: Page): Promise<void> {
  // Le bouton est rendu côté serveur : on attend l'hydratation avant de cliquer.
  await page.waitForLoadState('networkidle')
  await page.getByTestId('sign-in').click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

async function chooseHandle(page: Page, handle: string): Promise<void> {
  await page.getByLabel('Pseudo').fill(handle)
  await page.getByTestId('handle-submit').click()
}

test('la fenêtre de connexion s’ouvre, garde la page d’origine et se ferme avec Échap', async ({
  page,
}) => {
  await page.goto(WORK_PATH)
  await openSignIn(page)

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Connecte-toi à Trame' })).toBeVisible()
  await expect(page.getByTestId('sign-in-google')).toHaveAttribute(
    'href',
    `/api/v1/auth/google?returnTo=${encodeURIComponent(WORK_PATH)}`,
  )

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('« Créer ma liste de lecture » ouvre la fenêtre de connexion', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('home-create-list').click()

  await expect(page.getByRole('dialog')).toBeVisible()
})

test('première connexion : pseudo refusé puis accepté, retour sur la fiche, déconnexion', async ({
  page,
}) => {
  await page.goto(WORK_PATH)
  await openSignIn(page)
  await page.getByTestId('sign-in-google').click()

  await expect(page).toHaveURL(/\/signup\/handle/)
  await expect(page.getByRole('heading', { name: 'Choisis ton pseudo' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('handle-submit')).toBeDisabled()

  await chooseHandle(page, 'admin')
  await expect(page.getByRole('alert')).toHaveText('Ce pseudo est réservé. Choisis-en un autre.')

  const handle = uniqueHandle('Lecteur')
  await page.getByLabel('Pseudo').fill(handle)
  await expect(page.getByTestId('handle-address')).toContainText(`/u/${handle}`)
  await page.getByTestId('handle-submit').click()

  await expect(page).toHaveURL(WORK_PATH)
  await page.waitForLoadState('networkidle')
  const account = page.getByTestId('account-menu')
  await expect(account).toHaveText(`@${handle}`)

  await account.click()
  await page.getByTestId('sign-out').click()
  await expect(page.getByRole('heading', { name: 'Se déconnecter ?' })).toBeVisible()
  await page.getByTestId('confirm-cancel').click()
  await expect(account).toBeVisible()

  await account.click()
  await page.getByTestId('sign-out').click()
  await page.getByTestId('confirm-accept').click()
  await expect(page.getByTestId('sign-in')).toBeVisible()
  await expect(page.getByTestId('auth-notice')).toContainText('Tu es déconnecté')
})

test('le parcours reste en anglais depuis une page anglaise', async ({ page }) => {
  const workPath = '/en/work/1-the-fog-lanterns'
  await page.goto(workPath)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to Trame' })).toBeVisible()
  await page.getByRole('link', { name: 'Continue with Google' }).click()

  await expect(page).toHaveURL(/\/en\/signup\/handle/)
  await expect(page.getByRole('heading', { name: 'Choose your username' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Username').fill(uniqueHandle('Reader'))
  await page.getByTestId('handle-submit').click()

  await expect(page).toHaveURL(workPath)
  await expect(page.getByTestId('account-menu')).toBeVisible()
})

test('un retour de Google annulé depuis une page anglaise affiche l’avis en anglais', async ({
  page,
}) => {
  await page.goto('/en/work/1-the-fog-lanterns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const href = await page.getByTestId('sign-in-google').getAttribute('href')
  const start = await page.request.get(href as string, { maxRedirects: 0 })
  expect(start.status()).toBe(302)

  await page.goto('/api/v1/auth/google/callback?error=access_denied')

  await expect(page).toHaveURL(/\/en\/\?auth_error=cancelled/)
  await expect(page.getByTestId('auth-notice')).toContainText('Sign-in cancelled')
})

test.describe('boutons', () => {
  // Matrice CSS `matrix(a, b, c, d, tx, ty)` d'une transformation calculée.
  async function transformOf(page: Page, testId: string): Promise<number[]> {
    const value = await page.getByTestId(testId).evaluate((el) => getComputedStyle(el).transform)
    return value === 'none' ? [1, 0, 0, 1, 0, 0] : value.slice(7, -1).split(',').map(Number)
  }

  test('« Se connecter » s’enfonce au clic, sans rester incliné', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByTestId('sign-in').hover()
    await page.mouse.down()

    await expect.poll(async () => (await transformOf(page, 'sign-in')).slice(4)).toEqual([2, 2])
    expect((await transformOf(page, 'sign-in'))[1]).toBeCloseTo(0, 5)
    await page.mouse.up()
  })

  test('un bouton pleine largeur s’incline moins au survol qu’un bouton ordinaire', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Le survol n’existe pas au doigt.')
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const tilt = async (testId: string) => Math.abs((await transformOf(page, testId))[1] ?? 0)

    await page.getByTestId('sign-in').hover()
    await expect.poll(() => tilt('sign-in')).toBeGreaterThan(0.03)

    await page.getByTestId('home-create-list').hover()
    await expect.poll(() => tilt('home-create-list')).toBeGreaterThan(0.005)
    await expect.poll(() => tilt('home-create-list')).toBeLessThan(0.02)
  })
})

test('un pseudo déjà pris est refusé, quelle que soit la casse', async ({ browser }) => {
  const handle = uniqueHandle('Pris')
  const first = await browser.newContext()
  await signInWithGoogleAs(first, `first-${handle}`)
  const created = await first.request.post('/api/v1/auth/handle', { data: { handle } })
  expect(created.status()).toBe(201)

  const context = await browser.newContext()
  const page = await context.newPage()
  await signInWithGoogleAs(context, `second-${handle}`)
  await page.goto('/signup/handle')
  await page.waitForLoadState('networkidle')
  await chooseHandle(page, handle.toLowerCase())

  await expect(page.getByRole('alert')).toHaveText('Ce pseudo est déjà pris. Essaie un autre.')
  await first.close()
  await context.close()
})

test('un compte déjà connu est connecté directement, sans choisir de pseudo', async ({
  browser,
}) => {
  const sub = `known-${uniqueHandle()}`
  const first = await browser.newContext()
  await signInWithGoogleAs(first, sub)
  await first.request.post('/api/v1/auth/handle', { data: { handle: uniqueHandle('Connu') } })
  await first.close()

  const context = await browser.newContext()
  const page = await context.newPage()
  await signInWithGoogleAs(context, sub)
  await page.goto('/')

  await expect(page.getByTestId('account-menu')).toBeVisible()
  await context.close()
})

test('abandonner l’inscription ne crée aucun compte', async ({ page }) => {
  await page.goto('/')
  await openSignIn(page)
  await page.getByTestId('sign-in-google').click()
  await expect(page).toHaveURL(/\/signup\/handle/)
  await page.waitForLoadState('networkidle')

  await page.getByTestId('handle-cancel').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByTestId('confirm-cancel').click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/\/signup\/handle/)

  await page.getByTestId('handle-cancel').click()
  await page.getByTestId('confirm-accept').click()

  await expect(page).toHaveURL('/?auth_error=signup_cancelled')
  await expect(page.getByTestId('auth-notice')).toContainText('Inscription annulée')
  const me = await page.request.get('/api/v1/auth/me')
  expect(await me.json()).toEqual({ status: 'anonymous' })
  await expect(page.getByTestId('sign-in')).toBeVisible()
})

test('sans inscription en cours, la page du pseudo renvoie à l’accueil', async ({ page }) => {
  await page.goto('/signup/handle')

  await expect(page).toHaveURL('/')
})

test('un retour de Google annulé affiche un avis, qu’on peut fermer', async ({ page }) => {
  await page.goto('/?auth_error=cancelled')

  const notice = page.getByTestId('auth-notice')
  await expect(notice).toContainText('Connexion annulée')
  await page.waitForLoadState('networkidle')
  await notice.getByRole('button', { name: 'Fermer' }).click()

  await expect(notice).toBeHidden()
  await expect(page).toHaveURL('/')
})

test.describe('accessibilité', () => {
  async function expectNoViolation(page: Page) {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  }

  test('fenêtre de connexion ouverte', async ({ page }) => {
    await page.goto(WORK_PATH)
    await openSignIn(page)

    await expectNoViolation(page)
  })

  test('page du choix du pseudo, avec une erreur', async ({ page, context }) => {
    await signInWithGoogleAs(context, `a11y-${uniqueHandle()}`)
    await page.goto('/signup/handle')
    await page.waitForLoadState('networkidle')
    await chooseHandle(page, 'admin')
    await expect(page.getByRole('alert')).toBeVisible()

    await expectNoViolation(page)
  })
})

test('pas de défilement horizontal sur la page du pseudo à 320 px', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await signInWithGoogleAs(context, `narrow-${uniqueHandle()}`)
  await page.goto('/signup/handle')

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
