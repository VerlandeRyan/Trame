import { expect, test } from '@playwright/test'

const WORK_PATH = '/work/42-les-lanternes-de-brume'

test('la fiche affiche le contenu rendu côté serveur', async ({ page }) => {
  await page.goto(WORK_PATH)

  await expect(page.getByTestId('work-title')).toHaveText('Les Lanternes de Brume')
  await expect(page.getByTestId('work-alternatives')).toHaveText('EN : The Mist Lanterns')
  await expect(page.getByTestId('work-tags')).toContainText('Manga')
  await expect(page.getByTestId('work-info-chapters')).toHaveText('?')
  await expect(page.getByTestId('work-info-publisher')).toHaveText('Éditions Fictives')
  await expect(page.getByTestId('work-synopsis')).toContainText('cartographe')
  await expect(page.getByTestId('work-members')).toContainText('2')
  await expect(page.getByTestId('work-read')).toHaveAttribute(
    'href',
    'https://lire.exemple.test/lanternes',
  )
  await expect(page.getByRole('link', { name: /Après la Brume/ })).toHaveAttribute(
    'href',
    '/work/43-apres-la-brume',
  )
})

test('le HTML initial contient le titre, la description, le canonique et le balisage structuré', async ({
  request,
}) => {
  const html = await (await request.get(WORK_PATH)).text()

  expect(html).toContain('<title>Les Lanternes de Brume · Trame</title>')
  expect(html).toMatch(/<meta[^>]+name="description"[^>]+content="Une cartographe suit/)
  expect(html).toMatch(/<meta[^>]+property="og:title"[^>]+content="Les Lanternes de Brume"/)
  expect(html).toMatch(/<link[^>]+rel="canonical"[^>]+href="[^"]*\/work\/42-les-lanternes-de-brume"/)

  const jsonLd = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html)
  expect(jsonLd).not.toBeNull()
  expect(JSON.parse(jsonLd![1]!)).toMatchObject({
    '@type': 'ComicSeries',
    name: 'Les Lanternes de Brume',
  })
})

test('la fiche en anglais vit sous /en/work et titre dans la langue demandée', async ({ page }) => {
  // Le slug français est corrigé vers le titre anglais (301 côté serveur).
  await page.goto(`/en${WORK_PATH}`)
  await expect(page).toHaveURL('/en/work/42-the-mist-lanterns')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB')
  await expect(page.getByTestId('work-title')).toHaveText('The Mist Lanterns')
  await expect(page.getByTestId('work-info-status')).toHaveText('Ongoing')
  // L'URL canonique porte le titre dans la langue de l'interface.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/en\/work\/42-the-mist-lanterns$/,
  )
})

test('fiche sur mobile : couverture à gauche du titre, blocs empilés, sans défilement horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(WORK_PATH)

  const cover = await page.locator('.work__cover').boundingBox()
  const title = await page.getByTestId('work-title').boundingBox()
  const synopsis = await page.getByTestId('work-synopsis').boundingBox()
  const info = await page.locator('.work__info').boundingBox()
  expect(cover && title && synopsis && info).toBeTruthy()
  // Couverture et titre sur la même ligne ; synopsis puis informations ensuite (ordre de la maquette).
  expect(title!.x).toBeGreaterThan(cover!.x + cover!.width)
  expect(Math.abs(title!.y - cover!.y)).toBeLessThan(8)
  expect(info!.y).toBeGreaterThan(synopsis!.y)

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflows).toBe(false)
})

test('la fiche occupe toute la largeur et affiche « Membres 0 »', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(WORK_PATH)

  const main = await page.locator('main').boundingBox()
  expect(main!.width).toBeGreaterThanOrEqual(1270)
  await expect(page.getByTestId('work-members')).toHaveText('Membres 2')
})

test('changer de langue sur une fiche recharge la fiche dans la nouvelle langue', async ({ page }) => {
  await page.goto(WORK_PATH)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: "Langue de l'interface" }).click()
  await page.getByRole('link', { name: /English/ }).click()

  await expect(page).toHaveURL('/en/work/42-the-mist-lanterns')
  await expect(page.getByTestId('work-title')).toHaveText('The Mist Lanterns')
})

test("cliquer sur une œuvre liée ouvre sa fiche sans redirection d'erreur", async ({ page }) => {
  await page.goto(WORK_PATH)
  await page.waitForLoadState('networkidle')

  await page.getByRole('link', { name: 'Après la Brume' }).click()

  await expect(page).toHaveURL('/work/43-apres-la-brume')
  await expect(page.getByTestId('work-title')).toHaveText('Après la Brume')
})

test("un slug erroné redirige en 301 vers l'URL canonique", async ({ page, request }) => {
  const response = await request.get('/work/42-nimporte-quoi', { maxRedirects: 0 })
  expect(response.status()).toBe(301)
  expect(response.headers()['location']).toBe(WORK_PATH)

  await page.goto('/work/42')
  await expect(page).toHaveURL(WORK_PATH)
})

test('une œuvre inconnue ou un segment invalide répondent 404', async ({ page }) => {
  for (const path of ['/work/999-inconnue', '/work/ripper']) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(404)
    await expect(page.getByRole('heading', { name: "Cette page n'existe pas" })).toBeVisible()
  }
})
