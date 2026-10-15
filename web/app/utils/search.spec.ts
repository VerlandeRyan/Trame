import { describe, expect, it } from 'vitest'
import {
  activeFilters,
  activeQuery,
  changeSort,
  filterOptions,
  filterValueLabel,
  normalizeQuery,
  originalLine,
  pageItems,
  parseSearchQuery,
  resetFilters,
  toApiQuery,
  toRouteQuery,
  toggleFilter,
  totalPages,
  translatedCode,
} from './search'

describe('parseSearchQuery', () => {
  it('lit la recherche, les filtres valides et la page', () => {
    expect(
      parseSearchQuery({
        q: '  étoile   vagabonde ',
        type: 'series',
        format: 'webtoon',
        page: '3',
      }),
    ).toEqual({
      q: 'étoile vagabonde',
      page: 3,
      sort: 'relevance',
      filters: { type: ['series'], format: ['webtoon'] },
    })
  })

  it('lit le tri et ignore une valeur inconnue', () => {
    expect(parseSearchQuery({ q: 'tit', sort: 'recent' }).sort).toBe('recent')
    expect(parseSearchQuery({ q: 'tit', sort: 'note' }).sort).toBe('relevance')
  })

  it('trie par ajout récent sans texte de recherche, par pertinence avec', () => {
    expect(parseSearchQuery({}).sort).toBe('recent')
    expect(parseSearchQuery({ q: 'a' }).sort).toBe('recent')
    expect(parseSearchQuery({ q: 'ab' }).sort).toBe('relevance')
    // La pertinence demandée sans texte n'a pas de sens : retour au tri par défaut.
    expect(parseSearchQuery({ sort: 'relevance' }).sort).toBe('recent')
    expect(parseSearchQuery({ sort: 'title' }).sort).toBe('title')
  })

  it('n’envoie à l’API que le texte de 2 caractères ou plus', () => {
    expect(activeQuery(parseSearchQuery({ q: 'a' }))).toBe('')
    expect(activeQuery(parseSearchQuery({ q: ' ab ' }))).toBe('ab')
    expect(toApiQuery(parseSearchQuery({ q: 'a' }), { lang: 'fr', page: true })).not.toHaveProperty(
      'q',
    )
  })

  it('ignore les valeurs que l’API refuserait', () => {
    const state = parseSearchQuery({
      type: 'roman',
      status: 'lu',
      format: 'Manga',
      genre: 'a'.repeat(51),
      originalLanguage: 'FR',
      page: '0',
    })

    expect(state).toEqual({ q: '', page: 1, sort: 'recent', filters: {} })
  })

  it('prend la première valeur d’un paramètre répété et refuse une page non numérique', () => {
    expect(parseSearchQuery({ q: ['un', 'deux'], page: ['x'] })).toMatchObject({ q: 'un', page: 1 })
    expect(parseSearchQuery({ q: 42, page: '100001' })).toMatchObject({ q: '', page: 1 })
  })

  it('limite la recherche à 100 caractères', () => {
    expect(normalizeQuery('a'.repeat(150))).toHaveLength(100)
  })
})

describe('toRouteQuery et toApiQuery', () => {
  const state = parseSearchQuery({ q: 'tit', genre: 'fantasy', originalLanguage: 'ja', page: '2' })

  it('n’écrit que ce qui s’écarte des valeurs par défaut', () => {
    expect(toRouteQuery(state)).toEqual({
      q: 'tit',
      genre: 'fantasy',
      originalLanguage: 'ja',
      page: '2',
    })
    expect(toRouteQuery({ q: '', page: 1, sort: 'recent', filters: {} })).toEqual({})
    expect(toRouteQuery({ q: 'tit', page: 1, sort: 'relevance', filters: {} })).toEqual({
      q: 'tit',
    })
    expect(toRouteQuery({ q: '', page: 1, sort: 'title', filters: {} })).toEqual({ sort: 'title' })
  })

  it('envoie le tri à la liste, jamais aux compteurs', () => {
    const sorted = { ...state, sort: 'recent' as const }

    expect(toApiQuery(sorted, { lang: 'fr', page: true })).toMatchObject({ sort: 'recent' })
    expect(toApiQuery(sorted, { lang: 'fr' })).not.toHaveProperty('sort')
    expect(toApiQuery(state, { lang: 'fr', page: true })).not.toHaveProperty('sort')
  })

  it('prépare la liste avec la langue et la page, les compteurs sans', () => {
    expect(toApiQuery(state, { lang: 'fr', page: true })).toEqual({
      q: 'tit',
      genre: 'fantasy',
      originalLanguage: 'ja',
      lang: 'fr',
      page: 2,
      pageSize: 20,
    })
    expect(toApiQuery(state, { lang: 'fr' })).toEqual({
      q: 'tit',
      genre: 'fantasy',
      originalLanguage: 'ja',
    })
    expect(toApiQuery(state, { lang: 'fr', page: true, pageSize: 3 })).toMatchObject({
      pageSize: 3,
    })
  })
})

describe('critères et filtres', () => {
  it('liste les filtres actifs dans l’ordre d’affichage', () => {
    const state = parseSearchQuery({ status: 'ongoing', type: 'series' })
    expect(activeFilters(state)).toEqual([
      { key: 'type', code: 'series' },
      { key: 'status', code: 'ongoing' },
    ])
  })

  it('ajoute ou retire une valeur du groupe et revient à la première page', () => {
    const base = parseSearchQuery({ q: 'tit', type: 'series', page: '4' })

    const added = toggleFilter(base, 'type', 'oneshot')
    expect(added.filters.type).toEqual(['series', 'oneshot'])
    expect(added.page).toBe(1)

    const reduced = toggleFilter(added, 'type', 'series')
    expect(reduced.filters.type).toEqual(['oneshot'])

    const cleared = toggleFilter(base, 'type', 'series')
    expect(cleared.filters).toEqual({})
    expect(base.filters.type).toEqual(['series'])
  })

  it('ne dépasse pas le nombre maximal de valeurs par groupe', () => {
    const codes = Array.from({ length: 10 }, (_, index) => `genre_${index}`)
    const full = parseSearchQuery({ genre: codes.join(',') })
    expect(full.filters.genre).toHaveLength(10)

    expect(toggleFilter(full, 'genre', 'genre_extra').filters.genre).toEqual(codes)
  })

  it('lit plusieurs valeurs séparées par des virgules, sans doublon ni valeur invalide', () => {
    const state = parseSearchQuery({ status: 'ongoing, hiatus,ongoing,lu', type: ',' })

    expect(state.filters).toEqual({ status: ['ongoing', 'hiatus'] })
    expect(toRouteQuery(state)).toEqual({ status: 'ongoing,hiatus' })
  })

  it('réinitialise les filtres en gardant la recherche', () => {
    const state = resetFilters(parseSearchQuery({ q: 'tit', type: 'series', page: '2' }))
    expect(state).toEqual({ q: 'tit', page: 1, sort: 'relevance', filters: {} })
  })

  it('change le tri en gardant la recherche et revient à la première page', () => {
    const state = changeSort(parseSearchQuery({ q: 'tit', type: 'series', page: '3' }), 'title')
    expect(state).toMatchObject({ q: 'tit', page: 1, sort: 'title', filters: { type: ['series'] } })
  })

  it('garde les valeurs choisies même sans résultat', () => {
    const facets = [{ code: 'series', count: 4 }]
    expect(filterOptions(facets, [])).toBe(facets)
    expect(filterOptions(facets, ['series'])).toBe(facets)
    expect(filterOptions(facets, ['oneshot', 'anthology'])).toEqual([
      ...facets,
      { code: 'oneshot', count: 0 },
      { code: 'anthology', count: 0 },
    ])
  })
})

describe('libellés de codes', () => {
  const dictionary: Record<string, string> = { 'genre.manga': 'Manga', 'language.ja': 'Japonais' }
  const translate = (key: string) => dictionary[key] ?? key
  const has = (key: string) => key in dictionary

  it('traduit un code connu et renvoie le code sinon', () => {
    expect(translatedCode(translate, has, 'genre', 'manga')).toBe('Manga')
    expect(translatedCode(translate, has, 'genre', 'format_inconnu')).toBe('format_inconnu')
  })

  it('choisit le préfixe selon le filtre et met une langue inconnue en majuscules', () => {
    expect(filterValueLabel(translate, has, 'format', 'manga')).toBe('Manga')
    expect(filterValueLabel(translate, has, 'originalLanguage', 'ja')).toBe('Japonais')
    expect(filterValueLabel(translate, has, 'originalLanguage', 'xx')).toBe('XX')
    expect(filterValueLabel(translate, has, 'status', 'ongoing')).toBe('ongoing')
  })
})

describe('pagination', () => {
  it('calcule le nombre de pages, au moins une', () => {
    expect(totalPages(0)).toBe(1)
    expect(totalPages(20)).toBe(1)
    expect(totalPages(21)).toBe(2)
    expect(totalPages(34, 10)).toBe(4)
  })

  it('abrège les longues séries avec des « … »', () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(2, 3)).toEqual([1, 2, 3])
    expect(pageItems(1, 9)).toEqual([1, 2, 'gap', 9])
    expect(pageItems(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9])
    expect(pageItems(9, 9)).toEqual([1, 'gap', 8, 9])
  })
})

describe('originalLine', () => {
  const translated = { title: 'Marée creuse', originalTitle: 'Hollow Tide', originalLanguage: 'en' }
  const untranslated = {
    title: 'Hollow Tide',
    originalTitle: 'Hollow Tide',
    originalLanguage: 'en',
  }

  it('donne le titre original et sa langue quand le titre affiché est une traduction', () => {
    expect(originalLine(translated, 'fr')).toEqual({ language: 'en', title: 'Hollow Tide' })
  })

  it('le donne aussi quand le titre affiché est déjà l’original (aucune traduction)', () => {
    expect(originalLine(untranslated, 'fr')).toEqual({ language: 'en', title: 'Hollow Tide' })
  })

  it('n’affiche rien quand la langue de l’interface est la langue originale', () => {
    expect(originalLine(untranslated, 'en')).toBeNull()
    expect(originalLine({ ...translated, originalLanguage: 'fr' }, 'fr')).toBeNull()
  })
})
