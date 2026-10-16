import { expect, test } from '@playwright/test'

// Bureau par défaut, y compris dans le projet iPhone ; les tests mobiles fixent leur largeur.
test.use({ viewport: { width: 1280, height: 800 } })

// US-01 : suggestions, page de résultats, filtres.
test.describe('suggestions', () => {
  test('apparaissent dès 2 caractères et mènent à la fiche', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const input = page.getByTestId('search-input').first()

    await input.fill('l')
    await expect(page.getByTestId('search-suggestions').first()).toBeHidden()

    await input.fill('lanternes')
    const menu = page.getByTestId('search-suggestions').first()
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('option').first()).toContainText('Les Lanternes de Brume')
    await expect(menu.getByRole('option').first()).toContainText('Série · Manhwa · Webtoon · Mélodie Vasseur')

    await menu.getByRole('option').first().click()
    await expect(page).toHaveURL(/\/work\/1-les-lanternes-de-brume$/)
  })

  test('se rouvrent au clic dans le champ', async ({ page }) => {
    await page.goto('/search?q=basalte')
    await page.waitForLoadState('networkidle')
    const input = page.getByTestId('search-input').first()
    const menu = page.getByTestId('search-suggestions').first()
    await expect(menu).toBeHidden()

    await input.click()
    await expect(menu).toBeVisible()
    await input.press('Escape')
    await expect(menu).toBeHidden()
    await input.click()
    await expect(menu).toBeVisible()
  })

  test('se ferment avec Échap et Entrée ouvre la page de résultats', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const input = page.getByTestId('search-input').first()

    await input.fill('basalte')
    await expect(page.getByTestId('search-suggestions').first()).toBeVisible()
    await input.press('Escape')
    await expect(page.getByTestId('search-suggestions').first()).toBeHidden()

    await input.press('Enter')
    await expect(page).toHaveURL(/\/search\?q=basalte$/)
    await expect(page.getByTestId('search-count')).toHaveText('3 résultats pour « basalte »')
  })
})

test.describe('page de résultats', () => {
  test('liste les résultats, filtre par type et retire le filtre', async ({ page }) => {
    await page.goto('/search?q=basalte')
    // Hydratation terminée : sinon la case cochée trop tôt n'est pas prise en compte.
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('search-result')).toHaveCount(3)

    await page.getByTestId('filter-type-oneshot').first().check()
    await expect(page).toHaveURL(/type=oneshot/)
    await expect(page.getByTestId('search-result')).toHaveCount(1)
    await expect(page.getByTestId('search-result')).toContainText('Basalte – Histoires de Cendre')
    await expect(page.getByTestId('filter-type-series').first()).toBeVisible()

    await page.getByRole('button', { name: 'Réinitialiser' }).first().click()
    await expect(page.getByTestId('search-result')).toHaveCount(3)
    await expect(page).not.toHaveURL(/type=/)
  })

  test('« Retour » saute les filtres cochés et ramène à la page d’avant la recherche', async ({
    page,
  }) => {
    await page.goto('/')
    await page.goto('/search?q=basalte')
    await page.waitForLoadState('networkidle')

    await page.getByTestId('filter-type-series').first().check()
    await expect(page).toHaveURL(/type=series/)
    await page.getByTestId('filter-format-manga').first().check()
    await expect(page).toHaveURL(/format=manga/)

    await page.goBack()

    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/)
  })

  test('trie par titre ou par date d’ajout et garde le choix dans l’adresse', async ({ page }) => {
    await page.goto('/search?q=basalte')
    await page.waitForLoadState('networkidle')
    const titles = page.getByTestId('search-result').locator('h3')
    await expect(titles).toHaveCount(3)

    const sort = page.getByTestId('search-sort')
    await sort.click()
    await expect(page.getByRole('option', { name: 'Pertinence' })).toBeVisible()
    await page.getByRole('option', { name: 'Titre (A → Z)' }).click()
    await expect(page).toHaveURL(/sort=title/)
    await expect(sort).toHaveText('Titre (A → Z)')
    await expect(titles).toHaveText([
      'Basalte – Histoires de Cendre',
      'Basalte – Le Recueil des Braises',
      'Chroniques de Basalte',
    ])

    // Le jeu de démo est chargé d'un coup (même date d'ajout) : l'ordre exact est couvert côté API.
    await sort.click()
    await page.getByRole('option', { name: 'Ajoutées récemment' }).click()
    await expect(page).toHaveURL(/sort=recent/)
    await expect(sort).toHaveText('Ajoutées récemment')
    await expect(titles).toHaveCount(3)
  })

  test('« Tout replier » masque les valeurs, la pastille compte le choix', async ({ page }) => {
    await page.goto('/search?q=basalte&type=series')
    await page.waitForLoadState('networkidle')
    const aside = page.locator('aside')

    await expect(aside.getByTestId('filter-badge')).toHaveText('1')
    await expect(aside.getByTestId('filter-type-series')).toBeVisible()

    await aside.getByRole('button', { name: 'Tout déplier' }).click()
    await aside.getByRole('button', { name: 'Tout replier' }).click()
    await expect(aside.getByTestId('filter-type-series')).toBeHidden()
    await expect(aside.getByRole('button', { name: 'Tout déplier' })).toBeVisible()
  })

  test('plusieurs valeurs par catégorie : elles s’additionnent', async ({ page }) => {
    await page.goto('/search?q=basalte&type=series')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('search-result')).toHaveCount(1)

    await page.getByTestId('filter-type-oneshot').first().check()

    await expect(page).toHaveURL(/type=series%2Coneshot|type=series,oneshot/)
    await expect(page.getByTestId('search-result')).toHaveCount(2)
    await expect(page.getByTestId('filter-type-series').first()).toBeChecked()
    await expect(page.getByTestId('filter-type-oneshot').first()).toBeChecked()
    await expect(page.locator('aside').getByTestId('filter-badge')).toHaveText('2')
  })

  test('changer de langue garde la recherche et les filtres dans l’adresse', async ({ page }) => {
    await page.goto('/search?q=basalte&type=series,oneshot&sort=title')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: "Langue de l'interface" }).click()
    await page.getByRole('link', { name: /English/ }).click()

    await expect(page).toHaveURL(/\/en\/search\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('q')).toBe('basalte')
    expect(url.searchParams.get('type')).toBe('series,oneshot')
    expect(url.searchParams.get('sort')).toBe('title')
    await expect(page.getByTestId('search-count')).toHaveText('2 results for “basalte”')
  })

  test('sans texte de recherche : le catalogue, du plus récemment ajouté', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('search-count')).toHaveText('11 résultats')
    await expect(page.getByTestId('search-result')).toHaveCount(11)
    await page.getByTestId('search-sort').click()
    await expect(page.getByRole('option', { name: 'Pertinence' })).toHaveCount(0)
  })

  test('lancer une recherche après avoir fait défiler remonte en haut de la page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 360 })
    await page.goto('/search')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

    const input = page.getByTestId('search-input').first()
    await input.fill('basalte')
    await input.press('Enter')

    await expect(page).toHaveURL(/q=basalte/)
    await expect(page.getByTestId('search-count')).toHaveText('3 résultats pour « basalte »')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('l’en-tête suit le défilement, la colonne de filtres défile avec la page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 400 })
    await page.goto('/search?q=basalte')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      const spacer = document.createElement('div')
      spacer.style.height = '1500px'
      document.querySelector('.search-page__results')!.append(spacer)
    })
    const before = await page.locator('aside').boundingBox()
    await page.evaluate(() => window.scrollTo(0, 300))

    const header = await page.getByRole('banner').boundingBox()
    const after = await page.locator('aside').boundingBox()
    expect(header!.y).toBe(0)
    expect(after!.y).toBeLessThan(before!.y)
    const column = page.locator('aside')
    expect(await column.evaluate((element) => getComputedStyle(element).position)).toBe('static')
    expect(await column.evaluate((element) => getComputedStyle(element).overflowY)).toBe('visible')
  })

  test('lancer une recherche après un changement de langue met la liste à jour', async ({
    page,
  }) => {
    await page.goto('/search')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: "Langue de l'interface" }).click()
    await page.getByRole('link', { name: /English/ }).click()
    await expect(page).toHaveURL(/\/en\/search/)
    await page.waitForLoadState('networkidle')

    // Sous charge, la page anglaise peut ne pas être hydratée : on recommence la saisie jusqu'à
    // ce que le champ réagisse.
    const input = page.getByTestId('search-input').first()
    await expect(async () => {
      await input.fill('basalte')
      await input.press('Enter')
      await expect(page).toHaveURL(/\/en\/search\?q=basalte/, { timeout: 1500 })
    }).toPass()

    await expect(page.getByTestId('search-count')).toHaveText('3 results for “basalte”')
  })

  test('aucun résultat : carte centrée, sans colonne de filtres', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/search?q=xyzqw')
    await page.waitForLoadState('networkidle')

    const card = await page.getByTestId('search-empty').boundingBox()
    expect(card).toBeTruthy()
    const center = card!.x + card!.width / 2
    expect(Math.abs(center - 1280 / 2)).toBeLessThan(40)
    expect(card!.width).toBeGreaterThan(400)
    await expect(page.locator('aside')).toHaveCount(0)
  })

  test('sans résultat : message et bouton de proposition inactif', async ({ page }) => {
    await page.goto('/search?q=xyzqw')

    await expect(page.getByTestId('search-count')).toHaveText('Aucun résultat pour « xyzqw »')
    await expect(page.getByTestId('search-empty')).toContainText(
      "Cette œuvre n'est pas encore dans Trame",
    )
    await expect(page.getByTestId('search-propose')).toBeDisabled()
  })

  test('mobile : le champ est dans la page et les filtres dans une fenêtre', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/search?q=xyzqw')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /^Filtres/ })).toHaveCount(0)

    await page.goto('/search?q=basalte')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('search-open')).toHaveCount(0)
    await page.getByRole('button', { name: /^Filtres/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(Math.round(box!.y + box!.height)).toBe(844)
    await expect(dialog.getByTestId('sheet-reset')).toBeVisible()
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).overflow),
    ).toBe('hidden')
    // Complément de la page figée : vérifié là où la propriété existe.
    const overscroll = await dialog.locator('.modal__body').evaluate((element) => ({
      supported: CSS.supports('overscroll-behavior', 'contain'),
      value: getComputedStyle(element).getPropertyValue('overscroll-behavior-y'),
    }))
    if (overscroll.supported) expect(overscroll.value).toBe('contain')
    await dialog.getByTestId('filter-type-oneshot').check()
    await dialog.getByTestId('sheet-apply').click()

    await expect(page.getByTestId('search-result')).toHaveCount(1)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('la feuille de filtres se referme quand la fenêtre passe au format bureau', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/search?q=basalte&type=series')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /^Filtres/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.setViewportSize({ width: 1280, height: 800 })

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.locator('aside')).toBeVisible()
  })

  test('mobile : le champ se déploie sur la page courante et la croix le referme', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/work/1-les-lanternes-de-brume')
    await page.waitForLoadState('networkidle')
    const title = page.getByTestId('work-title')

    await page.getByTestId('search-open').click()
    await expect(page).toHaveURL(/\/work\/1-/)
    await expect(page.getByTestId('search-close')).toBeVisible()
    await expect(page.locator('.layout-header__logo')).toBeHidden()

    await page.getByTestId('search-input').first().fill('basalte')
    const menu = page.getByTestId('search-suggestions').first()
    await expect(menu).toBeVisible()
    await expect(title).toBeVisible()

    await page.getByTestId('search-close').click()
    await expect(page.getByTestId('search-close')).toBeHidden()
    await expect(page.locator('.layout-header__logo')).toBeVisible()
    await expect(title).toBeVisible()
  })
})

test('la page occupe toute la hauteur de la fenêtre', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/search?q=xyzqw')
  const main = await page.locator('main').boundingBox()
  expect(Math.round(main!.y + main!.height)).toBe(900)
})
