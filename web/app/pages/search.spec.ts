import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SearchPage from './search.vue'

const requests: { path: string; query: Record<string, unknown> }[] = []
let total = 34
let failing = false
let approximate = false
// Au-delà de cette page, l'API renvoie une liste vide avec un total non nul.
let lastPage = Number.POSITIVE_INFINITY

const queryOf = (path: string) =>
  Object.fromEntries(new URL(path, 'http://localhost').searchParams) as Record<string, unknown>

const item = (id: number, title: string) => ({
  id,
  title,
  originalTitle: title,
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  formats: ['webtoon'],
  coverPath: null,
  mainAuthor: 'Auteur A',
})

beforeEach(() => {
  requests.length = 0
  total = 34
  failing = false
  approximate = false
  lastPage = Number.POSITIVE_INFINITY
  useRuntimeConfig().apiBase = ''
  registerEndpoint('/api/v1/works', (event) => {
    requests.push({ path: '/works', query: queryOf(event.path) })
    if (failing) throw createError({ statusCode: 500, data: { code: 'INTERNAL_ERROR' } })
    const page = Number(queryOf(event.path).page ?? 1)
    const beyondLastPage = page > lastPage
    const items = total === 0 || beyondLastPage ? [] : [item(1, 'Titre A'), item(2, 'Titre B')]
    return { items, page, pageSize: 20, total, approximate }
  })
  registerEndpoint('/api/v1/works/facets', (event) => {
    requests.push({ path: '/works/facets', query: queryOf(event.path) })
    return {
      type: [
        { code: 'series', count: 28 },
        { code: 'oneshot', count: 5 },
      ],
      format: [{ code: 'webtoon', count: 9 }],
      genre: [{ code: 'fantasy', count: 12 }],
      status: [{ code: 'ongoing', count: 20 }],
      originalLanguage: [{ code: 'ja', count: 3 }],
    }
  })
})

describe('page de résultats', () => {
  it('liste le catalogue, du plus récemment ajouté, sans texte de recherche', async () => {
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=a' })

    expect(wrapper.get('[data-testid="search-count"]').text()).toBe('34 résultats')
    expect(requests).toContainEqual({
      path: '/works',
      query: { sort: 'recent', lang: 'fr', page: '1', pageSize: '20' },
    })
    await wrapper.get('[data-testid="search-sort"]').trigger('click')
    const labels = wrapper
      .findAll('.search-page__toolbar [role="option"]')
      .map((option) => option.text())
    expect(labels).toEqual(['Titre (A → Z)', 'Ajoutées récemment'])
  })

  it('rejoint la dernière page quand l’adresse en désigne une qui n’existe plus', async () => {
    lastPage = 2
    await mountSuspended(SearchPage, { route: '/search?q=tit&page=9' })

    await vi.waitFor(() => expect(useRoute().query).toEqual({ q: 'tit', page: '2' }))
  })

  it('affiche le titre de la liste montrée, pas celui de la dernière adresse saisie', async () => {
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit' })
    expect(wrapper.get('[data-testid="search-count"]').text()).toBe('34 résultats pour « tit »')

    await navigateTo({ path: '/search', query: { q: 'autre' } })

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="search-count"]').text()).toBe(
        '34 résultats pour « autre »',
      ),
    )
  })

  it('recharge la liste dans la nouvelle langue au changement de langue', async () => {
    await mountSuspended(SearchPage, { route: '/search?q=tit' })
    expect(requests).toContainEqual({
      path: '/works',
      query: { q: 'tit', lang: 'fr', page: '1', pageSize: '20' },
    })

    await useNuxtApp().$i18n.setLocale('en')

    await vi.waitFor(() =>
      expect(requests).toContainEqual({
        path: '/works',
        query: { q: 'tit', lang: 'en', page: '1', pageSize: '20' },
      }),
    )
    await useNuxtApp().$i18n.setLocale('fr')
  })

  it('annonce les résultats approchants et suit les compteurs', async () => {
    approximate = true
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=aube%20inconnue' })

    expect(wrapper.get('[data-testid="search-approximate"]').text()).toContain(
      'Aucune œuvre ne contient tous les mots',
    )
    expect(requests).toContainEqual({
      path: '/works/facets',
      query: { q: 'aube inconnue', match: 'any' },
    })
  })

  it('centre la carte « aucun résultat » dans une page sans colonne de filtres', async () => {
    total = 0
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=xyzqw' })

    expect(wrapper.find('.search-page__layout--single').exists()).toBe(true)
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(wrapper.find('.search-page__filters-item').exists()).toBe(false)
  })

  it('affiche le nombre de résultats, la liste, les filtres et la pagination', async () => {
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit&type=series&page=2' })

    expect(wrapper.get('[data-testid="search-count"]').text()).toBe('34 résultats pour « tit »')
    expect(wrapper.findAll('[data-testid="search-result"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="filter-type-series"]').element).toMatchObject({
      checked: true,
    })
    expect(wrapper.get('[aria-current="page"]').text()).toBe('2')
    // Liste : page et langue ; compteurs : recherche et filtres seulement.
    expect(requests).toEqual(
      expect.arrayContaining([
        {
          path: '/works',
          query: { q: 'tit', type: 'series', lang: 'fr', page: '2', pageSize: '20' },
        },
        { path: '/works/facets', query: { q: 'tit', type: 'series' } },
      ]),
    )
  })

  it('met à jour l’adresse quand on coche un filtre, et revient à la page 1', async () => {
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit&page=3' })

    await wrapper.get('[data-testid="filter-format-webtoon"]').trigger('change')

    await vi.waitFor(() => expect(useRoute().query).toEqual({ q: 'tit', format: 'webtoon' }))
  })

  it('retire un filtre depuis sa pastille', async () => {
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit&type=series' })

    await wrapper.get('.search-page__chip').trigger('click')

    await vi.waitFor(() => expect(useRoute().query).toEqual({ q: 'tit' }))
  })

  it('propose les trois tris, envoie le choix à la liste et revient à la page 1', async () => {
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit&page=3&sort=title' })

    const trigger = wrapper.get('[data-testid="search-sort"]')
    expect(trigger.text()).toBe('Titre (A → Z)')
    await trigger.trigger('click')
    const menu = wrapper.get('.search-page__toolbar [role="listbox"]')
    expect(menu.findAll('[role="option"]').map((option) => option.text())).toEqual([
      'Pertinence',
      'Titre (A → Z)',
      'Ajoutées récemment',
    ])
    expect(requests).toContainEqual({
      path: '/works',
      query: { q: 'tit', sort: 'title', lang: 'fr', page: '3', pageSize: '20' },
    })
    expect(requests).toContainEqual({ path: '/works/facets', query: { q: 'tit' } })

    await menu.get('[data-value="recent"]').trigger('click')

    await vi.waitFor(() => expect(useRoute().query).toEqual({ q: 'tit', sort: 'recent' }))
  })

  it('referme la feuille de filtres quand la fenêtre passe au format bureau', async () => {
    const listeners: ((event: { matches: boolean }) => void)[] = []
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      media: query,
      matches: false,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.push(listener),
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia
    try {
      const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit' })
      await wrapper.get('.search-page__filters-button').trigger('click')
      const dialog = wrapper.get('dialog').element as HTMLDialogElement
      expect(dialog.open).toBe(true)

      listeners.forEach((listener) => listener({ matches: true }))
      await nextTick()

      expect(dialog.open).toBe(false)
    } finally {
      window.matchMedia = original
    }
  })

  it('met « Tout replier » dans l’en-tête de la feuille, avant la croix', async () => {
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit' })
    const sheet = wrapper.get('dialog.modal--bottom')
    const collapse = sheet.get('[data-testid="sheet-collapse"]')

    expect(sheet.get('header').element.contains(collapse.element)).toBe(true)
    expect(collapse.text()).toBe('Tout replier')

    await collapse.trigger('click')

    expect(collapse.text()).toBe('Tout déplier')
    expect(
      sheet
        .findAll('.filter-group__title')
        .every((title) => title.attributes('aria-expanded') === 'false'),
    ).toBe(true)
  })

  it('range les filtres du mobile dans une feuille basse avec pied à deux boutons', async () => {
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit&type=series' })

    const sheet = wrapper.get('dialog.modal--bottom')
    expect(sheet.find('.filters__reset').exists()).toBe(false)
    expect(sheet.get('[data-testid="sheet-reset"]').text()).toBe('Réinitialiser')
    expect(sheet.get('[data-testid="sheet-apply"]').text()).toBe('Voir 34 résultats')

    await sheet.get('[data-testid="sheet-reset"]').trigger('click')

    await vi.waitFor(() => expect(useRoute().query).toEqual({ q: 'tit' }))
  })

  it('sépare le titre de la liste par une frise, et montre la pastille du groupe', async () => {
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit&type=series' })

    expect(wrapper.find('.search-page__head + .search-page__rule').exists()).toBe(true)
    expect(wrapper.get('aside [data-testid="filter-badge"]').text()).toBe('1')
  })

  it('affiche l’état sans résultat avec le bouton de proposition inactif', async () => {
    total = 0
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=xyzqw' })

    expect(wrapper.get('[data-testid="search-count"]').text()).toBe('Aucun résultat pour « xyzqw »')
    expect(wrapper.get('[data-testid="search-empty"]').text()).toContain(
      "Cette œuvre n'est pas encore dans Trame",
    )
    expect(wrapper.get('[data-testid="search-propose"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="search-result"]').exists()).toBe(false)
  })

  it('annonce l’indisponibilité de la recherche sans afficher le message technique', async () => {
    failing = true
    const wrapper = await mountSuspended(SearchPage, { route: '/search?q=tit' })

    expect(wrapper.text()).toContain('La recherche est indisponible pour le moment.')

    failing = false
    await wrapper.get('[data-testid="search-retry"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="search-result"]').exists()).toBe(true),
    )
  })

  it('réinitialise les filtres en gardant la recherche', async () => {
    const wrapper = await mountSuspended(SearchPage, {
      route: '/search?q=tit&type=series&status=ongoing',
    })

    await wrapper.get('aside .filters__reset').trigger('click')

    await vi.waitFor(() => expect(useRoute().query).toEqual({ q: 'tit' }))
  })
})
