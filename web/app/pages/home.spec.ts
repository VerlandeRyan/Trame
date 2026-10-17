import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import HomePage from './home.vue'

const summary = (id: number, title: string) => ({
  id,
  title,
  originalTitle: title,
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  formats: ['manga'],
  coverPath: null,
  mainAuthor: 'Autrice Inventée',
})

// `failing` : points d'accès en panne ; `empty` : l'API n'a aucune donnée pour l'accueil.
let failing: string[] = []
let empty = false

function respond<T>(name: string, body: T): T {
  if (failing.includes(name)) {
    throw createError({ statusCode: 500, data: { code: 'INTERNAL_ERROR' } })
  }
  return body
}

const BLOCKS = ['home-featured', 'home-recent', 'home-top-rated']

describe("page d'accueil", () => {
  let initialValue: boolean

  beforeEach(() => {
    initialValue = useRuntimeConfig().public.componentGallery
    useRuntimeConfig().apiBase = ''
    failing = []
    empty = false
    // Les données de la page sont gardées par clé entre deux montages : chaque test repart de zéro.
    clearNuxtData()
    registerEndpoint('/api/v1/works/featured', () =>
      respond('featured', {
        items: empty
          ? []
          : [{ ...summary(1, 'Aube Fictive'), synopsis: 'Résumé fictif.', recentAdditions: 4 }],
      }),
    )
    registerEndpoint('/api/v1/works/top-rated', () =>
      respond('top-rated', {
        items: empty
          ? []
          : [{ ...summary(2, 'Brume Fictive'), ratingAverage: 8.5, ratingCount: 12 }],
      }),
    )
    registerEndpoint('/api/v1/works', () =>
      respond('works', {
        items: empty ? [] : [summary(3, 'Crépuscule Fictif')],
        page: 1,
        pageSize: 6,
        total: 1,
        approximate: false,
      }),
    )
  })

  afterEach(() => {
    useRuntimeConfig().public.componentGallery = initialValue
  })

  it("affiche le titre, l'introduction et le champ de recherche", async () => {
    const wrapper = await mountSuspended(HomePage)

    expect(wrapper.get('[data-testid="home-title"]').text()).toBe(
      'La création européenne, à suivre en un seul endroit',
    )
    expect(wrapper.get('.home__highlight').text()).toBe('en un seul endroit')
    expect(wrapper.get('[data-testid="home-intro"]').text()).toBe(
      'Retrouve tes coups de cœur ou déniche ta prochaine claque.',
    )
    expect(wrapper.findAll('.home__keyword').map((keyword) => keyword.text())).toEqual([
      'coups de cœur',
      'claque',
    ])
    expect(wrapper.find('[role="combobox"]').exists()).toBe(true)
  })

  it('affiche les cinq tampons de formats, masqués aux lecteurs d’écran', async () => {
    const wrapper = await mountSuspended(HomePage)

    const stamps = wrapper.get('[data-testid="home-stamps"]')
    expect(stamps.attributes('aria-hidden')).toBe('true')
    expect(stamps.findAll('li').map((stamp) => stamp.text())).toEqual([
      'Manga',
      'BD',
      'Webtoon',
      'Webcomic',
      'Comics',
    ])
  })

  it('affiche le panneau « Pourquoi Trame ? » avec son bouton inactif', async () => {
    const wrapper = await mountSuspended(HomePage)

    const pitch = wrapper.get('[data-testid="home-pitch"]')
    expect(pitch.attributes('aria-label')).toBe('Pourquoi Trame ?')
    expect(pitch.findAll('li')).toHaveLength(3)
    expect(wrapper.get('[data-testid="home-create-list"]').attributes('disabled')).toBeDefined()
  })

  it("affiche tous les blocs quand l'API a des données", async () => {
    const wrapper = await mountSuspended(HomePage)

    for (const id of BLOCKS) expect(wrapper.find(`[data-testid="${id}"]`).exists(), id).toBe(true)
    expect(wrapper.get('[data-testid="home-propose"]').attributes('disabled')).toBeDefined()
  })

  it('masque les blocs sans donnée', async () => {
    empty = true

    const wrapper = await mountSuspended(HomePage)

    for (const id of BLOCKS) expect(wrapper.find(`[data-testid="${id}"]`).exists(), id).toBe(false)
    expect(wrapper.find('[data-testid="home-missing"]').exists()).toBe(true)
  })

  it("masque seulement le bloc dont l'appel échoue", async () => {
    failing = ['top-rated']

    const wrapper = await mountSuspended(HomePage)

    expect(wrapper.find('[data-testid="home-top-rated"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="home-recent"]').exists()).toBe(true)
  })

  it('ne propose jamais de lien vers la galerie de composants', async () => {
    useRuntimeConfig().public.componentGallery = true

    const wrapper = await mountSuspended(HomePage)

    expect(wrapper.find('a[href="/components"]').exists()).toBe(false)
  })
})
