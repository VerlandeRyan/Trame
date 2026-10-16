import { expect, test } from '@playwright/test'

// Données de démo (db/demo-data.sql) : À la une = Hollow Tide, Crépuscule, Aube ; mieux notées = 3 œuvres.
test("accueil en français, sans préfixe d'URL", async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR')
  await expect(page.getByTestId('home-title')).toHaveText(
    'La création européenne, à suivre en un seul endroit',
  )
  await expect(page.locator('.home__highlight')).toHaveText('en un seul endroit')
  await expect(page.getByTestId('home-intro')).toContainText('suis ta lecture')
})

test('accueil en anglais sous /en', async ({ page }) => {
  await page.goto('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB')
  await expect(page.getByTestId('home-intro')).toContainText('track your reading')
})

test('le sélecteur de langue bascule vers /en', async ({ page }) => {
  await page.goto('/')
  // Attendre l'hydratation : sinon le clic peut précéder les écouteurs.
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: "Langue de l'interface" }).click()
  await page.getByRole('link', { name: /English/ }).click()
  await expect(page).toHaveURL(/\/en\/?$/)
  await expect(page.getByTestId('home-intro')).toContainText('track your reading')
})

test('les cinq blocs de données et la proposition inactive sont présents', async ({ page }) => {
  await page.goto('/')

  for (const id of ['home-featured', 'home-explore', 'home-recent', 'home-top-rated']) {
    await expect(page.getByTestId(id)).toBeVisible()
  }
  await expect(page.getByTestId('home-propose')).toBeDisabled()
})

test("l'accueil ne propose aucun lien vers la galerie, même activée", async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('home-title')).toBeVisible()
  await expect(page.locator('a[href="/components"]')).toHaveCount(0)
})

test('les titres de bloc sont à l’encre, seuls le titre et les œuvres sont bleus', async ({
  page,
}) => {
  await page.goto('/')

  const ink = 'rgb(27, 42, 92)'
  const blue = 'rgb(35, 64, 184)'
  await expect(page.getByRole('heading', { level: 2, name: 'À la une' })).toHaveCSS('color', ink)
  await expect(page.getByRole('heading', { level: 2, name: 'Explorer' })).toHaveCSS('color', ink)
  await expect(page.getByRole('heading', { level: 2, name: 'Mieux notées' })).toHaveCSS('color', ink)
  await expect(page.getByTestId('home-title')).toHaveCSS('color', blue)
  await expect(page.getByTestId('featured-title')).toHaveCSS('color', blue)
})

test('les rangées occupent toute la largeur : les œuvres se partagent la ligne', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const shelf = page.getByTestId('home-recent')
  const row = await shelf.boundingBox()
  const boxes = await shelf.getByTestId('shelf-work').evaluateAll((items) =>
    items.map((item) => {
      const { x, width, height } = item.getBoundingClientRect()
      return { right: x + width, height }
    }),
  )
  // Les œuvres de la ligne se partagent toute la largeur ; celles qui ne tiennent pas sont masquées.
  const shown = boxes.filter((box) => box.height > 0)
  expect(shown.length).toBeGreaterThanOrEqual(7)
  expect(shown.length).toBeLessThan(boxes.length)
  expect(Math.abs(shown.at(-1)!.right - (row!.x + row!.width))).toBeLessThan(2)
})

test('« À la une » : les œuvres populaires de la semaine, avec précédent et suivant', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const title = page.getByTestId('featured-title')

  await expect(title).toHaveText('Marée creuse')
  await page.getByTestId('featured-next').click()
  await expect(title).toHaveText('Étoile Vagabonde – Crépuscule')
  await page.getByTestId('featured-dot').nth(2).click()
  await expect(title).toHaveText('Étoile Vagabonde – Aube')

  await page.getByTestId('featured-open').click()
  await expect(page).toHaveURL(/\/work\/9-etoile-vagabonde-aube$/)
})

test('« À la une » : le changement d’œuvre est animé, sans mouvement si l’animation est réduite', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const next = page.getByTestId('featured-next')
  const title = page.getByTestId('featured-title')

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(next).toHaveCSS('transition-duration', /^0\.12s/)
  await next.click()
  await expect(title).toHaveText('Étoile Vagabonde – Crépuscule')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(next).toHaveCSS('transition-duration', '0s')
  await page.getByTestId('featured-next').click()
  await expect(title).toHaveText('Étoile Vagabonde – Aube')
})

test('« À la une » : chaque pastille mène à son œuvre, y compris celle du milieu', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const title = page.getByTestId('featured-title')
  const dots = page.getByTestId('featured-dot')

  await dots.nth(1).click()
  await expect(title).toHaveText('Étoile Vagabonde – Crépuscule')
  await dots.nth(2).click()
  await expect(title).toHaveText('Étoile Vagabonde – Aube')
  await dots.nth(0).click()
  await expect(title).toHaveText('Marée creuse')
})

// Régression : des zones tactiles invisibles qui se recouvraient faisaient capter le clic de la
// pastille du milieu par sa voisine. Le point visé est celui qu'atteint un doigt ou une souris.
test('les commandes de « À la une » et d’Explorer reçoivent leurs propres clics', async ({
  page,
}) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const stolen = await page.evaluate(() => {
      const selector =
        '[data-testid="featured-dot"], [data-testid="featured-prev"], [data-testid="featured-next"], .explore__link'
      return [...document.querySelectorAll(selector)].flatMap((target) => {
        target.scrollIntoView({ block: 'center' })
        const box = target.getBoundingClientRect()
        const middle = box.top + box.height / 2
        // Centre, puis 6 px à l'intérieur des bords gauche et droit.
        return [box.left + box.width / 2, box.left + 6, box.right - 6].flatMap((x) => {
          const hit = document.elementFromPoint(x, middle)
          const owned = hit !== null && (hit === target || target.contains(hit))
          return owned ? [] : [`${target.textContent?.trim() || target.getAttribute('aria-label')}`]
        })
      })
    })

    expect(stolen, `${width} px`).toEqual([])
  }
})

test('« À la une » se fait glisser au doigt : à gauche la suite, à droite le retour', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const title = page.getByTestId('featured-title')
  const swipe = (from: number, to: number) =>
    page.getByTestId('featured-stage').evaluate(
      (stage, [start, end]) => {
        const send = (type: string, x: number) =>
          stage.dispatchEvent(
            new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientX: x, clientY: 200 }),
          )
        send('pointerdown', start!)
        send('pointerup', end!)
      },
      [from, to],
    )

  await swipe(300, 120)
  await expect(title).toHaveText('Étoile Vagabonde – Crépuscule')
  await swipe(100, 280)
  await expect(title).toHaveText('Marée creuse')
})

test('à la souris, la zone de clic d’une pastille ne déborde pas loin du rond ; au doigt elle fait 44 px', async ({
  page,
  hasTouch,
}) => {
  await page.goto('/')
  const dot = await page.getByTestId('featured-dot').nth(1).boundingBox()
  // Souris : 28 px de haut (le rond en fait 14) ; écran tactile : 44 px.
  expect(dot!.height).toBe(hasTouch ? 44 : 28)
})

test('le bouton « Se connecter pour proposer » est visiblement inactif', async ({ page }) => {
  await page.goto('/')
  const propose = page.getByTestId('home-propose')

  await expect(propose).toBeDisabled()
  await expect(propose).toHaveCSS('opacity', '0.5')
  await expect(propose).toHaveCSS('cursor', 'not-allowed')
})

test('survol à la souris : rose pour les formats, rose soutenu pour les genres, bleu pour « Tous les… »', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'Pas de survol sur écran tactile')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('explore-format-manga').hover()
  await expect(page.getByTestId('explore-format-manga')).toHaveCSS(
    'background-color',
    'rgb(240, 122, 156)',
  )
  await page.getByTestId('explore-genre-fantasy').hover()
  await expect(page.getByTestId('explore-genre-fantasy')).toHaveCSS(
    'background-color',
    'rgb(244, 160, 185)',
  )
  await page.getByTestId('explore-all-formats').hover()
  await expect(page.getByTestId('explore-all-formats')).toHaveCSS(
    'background-color',
    'rgb(207, 216, 255)',
  )
})

test('survol à la souris : la pastille sélectionnée du carrousel reste bleue', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'Pas de survol sur écran tactile')
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const dots = page.getByTestId('featured-dot')
  const circle = (index: number) =>
    dots
      .nth(index)
      .evaluate((dot) => getComputedStyle(dot, '::before').backgroundColor)

  await dots.nth(0).hover()
  await expect.poll(() => circle(0)).toBe('rgb(35, 64, 184)')
  await dots.nth(1).hover()
  await expect.poll(() => circle(1)).toBe('rgb(240, 122, 156)')
})

test('écran tactile : aucun état de survol ne reste collé après un toucher', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const hoverNone = await page.evaluate(() => matchMedia('(hover: none)').matches)
  test.skip(!hoverNone, 'Appareil à souris')

  const next = page.getByTestId('featured-next')
  await next.tap()
  await expect(page.getByTestId('featured-title')).toHaveText('Étoile Vagabonde – Crépuscule')
  await expect(next).toHaveCSS('transform', 'none')
  await expect(next).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

test('Explorer : chaque rangée de pastilles occupe toute la largeur', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const lists = page.getByTestId('home-explore').locator('.explore__list')
  const section = await page.getByTestId('home-explore').boundingBox()
  for (const index of [0, 1]) {
    const rights = await lists
      .nth(index)
      .locator('li')
      .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().right))
    expect(Math.abs(Math.max(...rights) - (section!.x + section!.width))).toBeLessThan(2)
  }
})

test('« Mieux notées » : seulement les œuvres de 10 notes ou plus, avec la moyenne', async ({
  page,
}) => {
  await page.goto('/')
  const shelf = page.getByTestId('home-top-rated')

  await expect(shelf.getByTestId('shelf-work').locator('h3')).toHaveText([
    'Étoile Vagabonde',
    'Basalte – Le Recueil des Braises',
    'Marée creuse',
  ])
  await expect(shelf).toContainText('9,0 · 12 notes')
})

test('« Récemment ajoutées » mène à la recherche triée, Explorer à la recherche filtrée', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page
    .getByTestId('home-recent')
    .getByRole('link', { name: /Tout voir/ })
    .click()
  await expect(page).toHaveURL(/\/search\?sort=recent$/)

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('explore-format-manga').click()
  await expect(page).toHaveURL(/\/search\?format=manga$/)
  await expect(page.getByTestId('filter-format-manga').first()).toBeChecked()
})

test('la recherche de l’accueil mène aux résultats', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('search-input').fill('basalte')
  await page.getByTestId('home-search-submit').click()

  await expect(page).toHaveURL(/\/search\?q=basalte$/)
  await expect(page.getByTestId('search-count')).toHaveText('3 résultats pour « basalte »')
})

test("pas de champ de recherche dans l'en-tête de l'accueil, seul celui de la page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  await expect(page.getByRole('banner').getByRole('combobox')).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('combobox')).toHaveCount(1)
})

test('mobile : trois œuvres par rangée, sans défilement horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(
    page.getByTestId('home-recent').getByTestId('shelf-work').locator('visible=true'),
  ).toHaveCount(3)
  await expect(page.getByTestId('home-search-submit')).toBeHidden()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
