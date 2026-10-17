import { expect, test } from '@playwright/test'

// Données de démo (db/demo-data.sql) : À la une = Hollow Tide, Crépuscule, Aube ; mieux notées = 3 œuvres.
test("accueil en français, sans préfixe d'URL", async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR')
  await expect(page.getByTestId('home-title')).toHaveText(
    'La création européenne, à suivre en un seul endroit',
  )
  await expect(page.locator('.home__highlight')).toHaveText('en un seul endroit')
  await expect(page.getByTestId('home-intro')).toHaveText(
    'Retrouve tes coups de cœur ou déniche ta prochaine claque.',
  )
})

test('accueil en anglais sous /en', async ({ page }) => {
  await page.goto('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB')
  await expect(page.getByTestId('home-intro')).toContainText('favourites')
})

test('le sélecteur de langue bascule vers /en', async ({ page }) => {
  await page.goto('/')
  // Attendre l'hydratation : sinon le clic peut précéder les écouteurs.
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: "Langue de l'interface" }).click()
  await page.getByRole('link', { name: /English/ }).click()
  await expect(page).toHaveURL(/\/en\/?$/)
  await expect(page.getByTestId('home-intro')).toContainText('favourites')
})

test('les blocs de données et les boutons inactifs sont présents, sans bloc Explorer', async ({
  page,
}) => {
  await page.goto('/')

  for (const id of ['home-pitch', 'home-featured', 'home-recent', 'home-top-rated']) {
    await expect(page.getByTestId(id)).toBeVisible()
  }
  await expect(page.getByTestId('home-explore')).toHaveCount(0)
  await expect(page.getByTestId('home-propose')).toBeDisabled()
  await expect(page.getByTestId('home-create-list')).toBeDisabled()
})

test('hero : le panneau « Pourquoi Trame ? » est à droite du titre au bureau, sous la recherche au mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const title = (await page.getByTestId('home-title').boundingBox())!
  const pitch = (await page.getByTestId('home-pitch').boundingBox())!
  expect(pitch.x).toBeGreaterThan(title.x + title.width)
  await expect(page.getByTestId('home-pitch').getByRole('heading', { level: 3 })).toHaveCount(3)

  await page.setViewportSize({ width: 390, height: 844 })
  const search = (await page.getByRole('main').getByRole('combobox').boundingBox())!
  const mobilePitch = (await page.getByTestId('home-pitch').boundingBox())!
  expect(mobilePitch.y).toBeGreaterThan(search.y + search.height)
})

test('hero mobile : titre, sous-titre, tampons sur une ligne, puis recherche', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const top = (locator: ReturnType<typeof page.locator>) =>
    locator.boundingBox().then((box) => box!.y)
  const stamps = page.getByTestId('home-stamps')
  const orderedTops = [
    await top(page.getByTestId('home-title')),
    await top(page.getByTestId('home-intro')),
    await top(stamps),
    await top(page.getByRole('main').getByRole('combobox')),
  ]
  expect(orderedTops).toEqual([...orderedTops].sort((a, b) => a - b))
  const stampTops = await stamps
    .locator('li')
    .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)))
  // Une seule ligne : les inclinaisons décalent chaque tampon de quelques pixels au plus.
  expect(Math.max(...stampTops) - Math.min(...stampTops)).toBeLessThan(8)
})

test('hero : les tampons et le panneau tiennent à 360 px, sans défilement horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('/')
  await expect(page.getByTestId('home-stamps')).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('le titre est en Poppins auto-hébergée, sans appel à un CDN', async ({ page }) => {
  const outside: string[] = []
  await page.goto('/')
  const ownHost = new URL(page.url()).host
  page.on('request', (request) => {
    const { protocol, host } = new URL(request.url())
    if (protocol.startsWith('http') && host !== ownHost) outside.push(request.url())
  })
  await page.reload()
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('home-title')).toHaveCSS('font-family', /Poppins/)
  const loaded = await page.evaluate(() => document.fonts.check("800 1em 'Poppins'"))
  expect(loaded).toBe(true)
  expect(outside).toEqual([])
})

test('le hero est sur un fond bleu pâle, le reste de la page sur le papier', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.home__hero')).toHaveCSS('background-color', 'rgb(238, 241, 255)')
  await expect(page.getByTestId('home-featured')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
})

test('le badge « Populaire cette semaine » est jaune doré', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.featured__badge').first()).toHaveCSS(
    'background-color',
    'rgb(255, 201, 51)',
  )
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
  await expect(page.getByRole('heading', { level: 2, name: 'Mieux notées' })).toHaveCSS(
    'color',
    ink,
  )
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
test('les commandes de « À la une » reçoivent leurs propres clics', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const stolen = await page.evaluate(() => {
      const selector =
        '[data-testid="featured-dot"], [data-testid="featured-prev"], [data-testid="featured-next"]'
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
            new PointerEvent(type, {
              bubbles: true,
              pointerType: 'touch',
              clientX: x,
              clientY: 200,
            }),
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
  // Le bloc Explorer n'est plus sur l'accueil (il rejoint l'en-tête, #97) : la galerie le montre.
  await page.goto('/components')
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
    dots.nth(index).evaluate((dot) => getComputedStyle(dot, '::before').backgroundColor)

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
  await page.goto('/components')

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
  // Explorer : bloc de la galerie `/components` (voir plus haut).
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page
    .getByTestId('home-recent')
    .getByRole('link', { name: /Tout voir/ })
    .click()
  await expect(page).toHaveURL(/\/search\?sort=recent$/)

  await page.goto('/components')
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

test('« À la une » : le nombre de lecteurs de la semaine est affiché', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('featured-readers')).toHaveText(
    /^\d+ lecteurs? l’(a|ont) ajoutée cette semaine$/,
  )
})

test('« À la une » mobile : badge, titre et auteur à côté de la couverture, le reste dessous', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const slide = page.getByTestId('featured-slide')
  const cover = (await slide.locator('.featured__cover').boundingBox())!
  const badge = (await slide.locator('.featured__badge').boundingBox())!
  const title = (await page.getByTestId('featured-title').boundingBox())!
  const meta = (await slide.locator('.featured__meta').boundingBox())!

  expect(badge.x).toBeGreaterThanOrEqual(cover.x + cover.width)
  expect(title.x).toBeGreaterThanOrEqual(cover.x + cover.width)
  expect(title.y).toBeGreaterThan(badge.y)
  // Le haut du badge est aligné sur le haut de la couverture ; l'auteur est sous le titre.
  expect(Math.abs(badge.y - cover.y)).toBeLessThanOrEqual(1)
  expect(meta.x).toBeGreaterThanOrEqual(cover.x + cover.width)
  expect(meta.y).toBeGreaterThanOrEqual(title.y + title.height)

  // Le reste prend la place libérée : il commence sous la couverture, à gauche de la carte.
  const synopsis = (await slide.locator('.featured__synopsis').boundingBox())!
  expect(synopsis.y).toBeGreaterThanOrEqual(cover.y + cover.height)
  expect(synopsis.x).toBeLessThan(cover.x + cover.width)

  // Le bouton garde sa largeur naturelle, il ne remplit pas la carte.
  const open = (await page.getByTestId('featured-open').boundingBox())!
  const card = (await slide.boundingBox())!
  expect(open.width).toBeLessThan(card.width / 2)
})

test('les icônes de « Pourquoi Trame ? » reprennent les couleurs de l’app', async ({ page }) => {
  await page.goto('/')

  const icons = page.getByTestId('home-pitch').locator('.pitch__icon')
  await expect(icons.nth(0)).toHaveCSS('background-color', 'rgb(76, 195, 138)')
  await expect(icons.nth(1)).toHaveCSS('background-color', 'rgb(207, 194, 245)')
  await expect(icons.nth(2)).toHaveCSS('background-color', 'rgb(255, 201, 51)')
})

test('hero large : le panneau garde une marge à droite, le titre reste sur deux lignes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 900 })
  await page.goto('/')

  const pitch = (await page.getByTestId('home-pitch').boundingBox())!
  expect(1920 - (pitch.x + pitch.width)).toBeGreaterThanOrEqual(200)
  const title = (await page.getByTestId('home-title').boundingBox())!
  const lineHeight = await page
    .getByTestId('home-title')
    .evaluate((element) => parseFloat(getComputedStyle(element).lineHeight))
  expect(Math.round(title.height / lineHeight)).toBe(2)
})
