import { expect, test } from '@playwright/test'

const WORK_PATH = '/work/1-les-lanternes-de-brume'

test('la fiche affiche le contenu rendu côté serveur', async ({ page }) => {
  await page.goto(WORK_PATH)

  await expect(page.getByTestId('work-title')).toHaveText('Les Lanternes de Brume')
  await expect(page.getByTestId('work-alternatives')).toContainText('EN : The Fog Lanterns')
  await expect(page.getByTestId('work-tags')).toContainText('Manhwa')
  await expect(page.getByTestId('work-info-chapters')).toHaveText('120')
  await expect(page.getByTestId('work-info-publisher')).toContainText('Planche Ouverte (fictive)')
  await expect(page.getByTestId('work-synopsis')).toContainText('allumeuse')
  await expect(page.getByTestId('work-members')).toContainText('1')
  await expect(page.getByTestId('work-read')).toHaveAttribute(
    'href',
    'https://planche-ouverte.exemple.test/lanternes',
  )
})

test('la fiche liste les œuvres liées avec leur adresse canonique', async ({ page }) => {
  await page.goto('/work/2-chroniques-de-basalte')

  await expect(page.getByRole('link', { name: /Histoires de Cendre/ })).toHaveAttribute(
    'href',
    '/work/6-basalte-histoires-de-cendre',
  )
})

test('le HTML initial contient le titre, la description, le canonique et le balisage structuré', async ({
  request,
}) => {
  const html = await (await request.get(WORK_PATH)).text()

  expect(html).toContain('<title>Les Lanternes de Brume · Trame</title>')
  expect(html).toMatch(/<meta[^>]+name="description"[^>]+content="Une apprentie allumeuse/)
  expect(html).toMatch(/<meta[^>]+property="og:title"[^>]+content="Les Lanternes de Brume"/)
  expect(html).toMatch(/<link[^>]+rel="canonical"[^>]+href="[^"]*\/work\/1-les-lanternes-de-brume"/)

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
  await expect(page).toHaveURL('/en/work/1-the-fog-lanterns')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB')
  await expect(page.getByTestId('work-title')).toHaveText('The Fog Lanterns')
  await expect(page.getByTestId('work-info-status')).toHaveText('Completed')
  // L'URL canonique porte le titre dans la langue de l'interface.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/en\/work\/1-the-fog-lanterns$/,
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

test('la fiche occupe toute la largeur et affiche « Membres 1 »', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(WORK_PATH)

  const main = await page.locator('main').boundingBox()
  expect(main!.width).toBeGreaterThanOrEqual(1270)
  await expect(page.getByTestId('work-members')).toHaveText('Membres 1')
})

test('changer de langue sur une fiche recharge la fiche dans la nouvelle langue', async ({ page }) => {
  await page.goto(WORK_PATH)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: "Langue de l'interface" }).click()
  await page.getByRole('link', { name: /English/ }).click()

  await expect(page).toHaveURL('/en/work/1-the-fog-lanterns')
  await expect(page.getByTestId('work-title')).toHaveText('The Fog Lanterns')
})

test("cliquer sur une œuvre liée ouvre sa fiche sans redirection d'erreur", async ({ page }) => {
  await page.goto('/work/2-chroniques-de-basalte')
  await page.waitForLoadState('networkidle')

  await page.getByRole('link', { name: /Histoires de Cendre/ }).click()

  await expect(page).toHaveURL('/work/6-basalte-histoires-de-cendre')
  await expect(page.getByTestId('work-title')).toHaveText('Basalte – Histoires de Cendre')
})

test('beaucoup d’auteurs : trois visibles, « + N autres auteurs » et « Voir tout »', async ({
  page,
}) => {
  // L'anthologie du jeu de démo crédite cinq personnes.
  await page.goto('/work/7-basalte-le-recueil-des-braises')
  await page.waitForLoadState('networkidle')
  const people = page.locator('.people')

  await expect(people.locator('li')).toHaveCount(3)
  // Le nombre masqué est un texte ; l'action est « Voir tout », sur la même ligne.
  await expect(people.locator('.people__more-label')).toHaveText('+ 2 autres auteurs')
  const toggle = people.getByRole('button', { name: 'Voir tout' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await toggle.click()

  await expect(people.locator('li')).toHaveCount(5)
  await expect(people.locator('.people__more-label')).toHaveCount(0)
  const collapse = people.getByRole('button', { name: 'Réduire' })
  await expect(collapse).toHaveAttribute('aria-expanded', 'true')

  await collapse.click()
  await expect(people.locator('li')).toHaveCount(3)
})

test("un slug erroné redirige en 301 vers l'URL canonique", async ({ page, request }) => {
  const response = await request.get('/work/1-nimporte-quoi', { maxRedirects: 0 })
  expect(response.status()).toBe(301)
  expect(response.headers()['location']).toBe(WORK_PATH)

  await page.goto('/work/1')
  await expect(page).toHaveURL(WORK_PATH)
})

test('une œuvre inconnue ou un segment invalide répondent 404', async ({ page }) => {
  for (const path of ['/work/999-inconnue', '/work/aube-fictive']) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(404)
    await expect(page.getByRole('heading', { name: "Cette page n'existe pas" })).toBeVisible()
  }
})
