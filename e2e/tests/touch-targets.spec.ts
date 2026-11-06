import { expect, test, type Page } from '@playwright/test'
import { signInAsAdmin } from '../support/admin.js'
import { signUp } from '../support/session.js'

// #156 : au doigt (`pointer: coarse`), chaque petit lien ou bouton répond sur 44 px de haut sans
// que sa zone invisible ne passe devant un voisin. Le tactile est émulé pour activer la requête.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const TOUCH = 44

/** Cibles de `selector` dont le haut ou le bas de la zone de 44 px répond à un autre élément. */
async function stolenZones(page: Page, selector: string): Promise<string[]> {
  return page.evaluate(
    ({ selector: query, touch }) =>
      [...document.querySelectorAll(query)].flatMap((target) => {
        target.scrollIntoView({ block: 'center' })
        const box = target.getBoundingClientRect()
        // Sur plusieurs lignes le centre de la boîte peut tomber entre deux lignes de texte.
        if (box.height >= touch || target.getClientRects().length > 1) return []
        const x = box.left + box.width / 2
        const middle = box.top + box.height / 2
        // Le haut, le centre et le bas de la zone de 44 px, à 1 px du bord.
        return [middle - touch / 2 + 1, middle, middle + touch / 2 - 1].flatMap((y) => {
          const hit = document.elementFromPoint(x, y)
          const owned = hit !== null && (hit === target || target.contains(hit))
          return owned ? [] : [`${target.textContent?.trim()} à ${Math.round(y - middle)} px`]
        })
      }),
    { selector, touch: TOUCH },
  )
}

async function heightOf(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox()
  return Math.round(box!.height)
}

test('accueil : logo et « Tout voir » ont une zone de 44 px', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(await stolenZones(page, '.layout-header__logo')).toEqual([])
  expect(await stolenZones(page, '.shelf__all')).toEqual([])
})

test('recherche : titres, « Filtres » et « + » ont une zone de 44 px', async ({ page }) => {
  await page.goto('/search?q=basalte')
  await page.waitForLoadState('networkidle')
  expect(await stolenZones(page, '.result__link')).toEqual([])
  expect(await heightOf(page, '.search-page__filters-button')).toBeGreaterThanOrEqual(TOUCH)
  expect(await heightOf(page, '.result__add')).toBeGreaterThanOrEqual(TOUCH)
})

test('administration : « ‹ Catalogue » a une zone de 44 px', async ({ context, page }) => {
  await signInAsAdmin(context)
  await page.goto('/admin/catalogue/works/new')
  await page.waitForLoadState('networkidle')
  expect(await stolenZones(page, '[data-testid="admin-back"]')).toEqual([])
})

test('liste d’un membre : « Retour au profil » a une zone de 44 px', async ({ context, page }) => {
  const handle = await signUp(context)
  await page.goto(`/u/${handle}/list`)
  await page.waitForLoadState('networkidle')
  expect(await stolenZones(page, '[data-testid="member-list-back"]')).toEqual([])
})
