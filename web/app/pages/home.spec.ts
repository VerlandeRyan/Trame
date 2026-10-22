import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import HomePage from './home.vue'

// Une page restée montée relit ses données quand la connexion change : elle fausserait le test suivant.
enableAutoUnmount(afterEach)

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

  it('affiche le panneau « Pourquoi Trame ? » avec son bouton actif', async () => {
    const wrapper = await mountSuspended(HomePage)

    const pitch = wrapper.get('[data-testid="home-pitch"]')
    expect(pitch.attributes('aria-label')).toBe('Pourquoi Trame ?')
    expect(pitch.findAll('li')).toHaveLength(3)
    expect(wrapper.get('[data-testid="home-create-list"]').attributes('disabled')).toBeUndefined()
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

  describe('membre connecté', () => {
    const MEMBER = { status: 'authenticated', user: { id: 1, handle: 'lectrice', role: 'user' } }
    const reading = {
      work: { ...summary(9, 'Lanterne Fictive'), chapters: null, volumes: null },
      entry: {
        status: 'reading',
        chaptersRead: 4,
        volumesRead: 0,
        rating: null,
        startedOn: null,
        finishedOn: null,
      },
    }
    const counts = (reading: number, plan: number) => ({
      reading,
      completed: 0,
      plan_to_read: plan,
      on_hold: 0,
      dropped: 0,
    })
    let entriesPage: { items: unknown[]; statusCounts: unknown } | null = null

    beforeEach(() => {
      useState('auth').value = MEMBER
      entriesPage = { items: [reading], statusCounts: counts(1, 0) }
      registerEndpoint('/api/v1/me/entries', () => {
        if (entriesPage === null) {
          throw createError({ statusCode: 500, data: { code: 'INTERNAL_ERROR' } })
        }
        return entriesPage
      })
    })

    // Une page montée relit ses données quand la connexion change : on la démonte avant de la changer.
    const mounted: { unmount: () => void }[] = []
    async function mountHome() {
      const wrapper = await mountSuspended(HomePage)
      mounted.push(wrapper)
      return wrapper
    }

    afterEach(() => {
      for (const wrapper of mounted.splice(0)) wrapper.unmount()
      useState('auth').value = { status: 'anonymous' }
    })

    it('salue le membre, avec la bande « Reprendre la lecture » et sans panneau visiteur', async () => {
      const wrapper = await mountHome()

      expect(wrapper.get('[data-testid="home-title"]').text()).toBe('Bon retour, @lectrice')
      expect(wrapper.get('[data-testid="home-intro"]').text()).toBe(
        'Où en es-tu dans tes lectures ?',
      )
      expect(wrapper.findAll('[data-testid="continue-reading-work"]')).toHaveLength(1)
      for (const id of ['home-pitch', 'home-stamps', 'home-empty', 'home-formats']) {
        expect(wrapper.find(`[data-testid="${id}"]`).exists(), id).toBe(false)
      }
    })

    it('propose de partir d’un format quand la liste est vide', async () => {
      entriesPage = { items: [], statusCounts: counts(0, 0) }

      const wrapper = await mountHome()

      expect(wrapper.get('[data-testid="home-title"]').text()).toBe(
        'Bienvenue sur Trame, @lectrice',
      )
      expect(wrapper.find('[data-testid="home-continue-reading"]').exists()).toBe(false)
      const manga = wrapper.get('[data-testid="home-format-manga"]')
      expect(manga.attributes('href')).toBe('/search?format=manga')
    })

    it('garde « Bon retour » sans bande quand rien n’est en cours mais que la liste existe', async () => {
      entriesPage = { items: [], statusCounts: counts(0, 2) }

      const wrapper = await mountHome()

      expect(wrapper.get('[data-testid="home-title"]').text()).toBe('Bon retour, @lectrice')
      expect(wrapper.find('[data-testid="home-formats"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="home-continue-reading"]').attributes('style')).toContain(
        'none',
      )
    })

    it("n'affiche pas « liste vide » quand la lecture de la liste échoue", async () => {
      entriesPage = null

      const wrapper = await mountHome()

      expect(wrapper.get('[data-testid="home-title"]').text()).toBe('Bon retour, @lectrice')
      expect(wrapper.find('[data-testid="home-continue-reading"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="home-empty"]').exists()).toBe(false)
    })
  })

  it('ne propose jamais de lien vers la galerie de composants', async () => {
    useRuntimeConfig().public.componentGallery = true

    const wrapper = await mountSuspended(HomePage)

    expect(wrapper.find('a[href="/components"]').exists()).toBe(false)
  })
})
