import { describe, expect, it } from 'vitest'
import {
  adminEditPath,
  archiveImpact,
  adminErrorKey,
  digitsOnly,
  draftToPersonBody,
  draftToPublisherBody,
  draftToWorkBody,
  emptyPersonDraft,
  emptyPublisherDraft,
  emptyWorkDraft,
  hasIncompleteRows,
  invalidFields,
  itemLabel,
  languageCode,
  optionsOf,
  pageCount,
  parseAdminEditRoute,
  parseAdminListQuery,
  parseWorkSection,
  personToDraft,
  publisherToDraft,
  queryForTab,
  tabOf,
  toAdminApiQuery,
  toAdminRouteQuery,
  workToDraft,
  type AdminListQuery,
  type AdminWork,
  type WorkLabels,
} from './admin'

const WORK: AdminWork = {
  id: 4,
  title: 'Aube Fictive',
  originalLanguage: 'fr',
  type: 'series',
  status: 'completed',
  archived: false,
  chapters: 86,
  volumes: null,
  startedOn: '2020-01-01',
  endedOn: null,
  titles: [{ language: 'en', kind: 'international', title: 'Fictive Dawn' }],
  synopses: [{ language: 'fr', text: 'Un résumé.', source: 'official' }],
  credits: [{ personId: 2, role: 'story' }],
  publisherIds: [3],
  genres: ['manga'],
  relations: [{ relatedWorkId: 9, relation: 'sequel' }],
  links: [{ kind: 'read', url: 'https://exemple.test', label: null }],
  followerCount: 34,
  updatedAt: '2026-10-24T10:00:00.000Z',
}

const LABELS: WorkLabels = {
  people: new Map([[2, 'Léa Auteure']]),
  publishers: new Map([[3, 'Maison Fictive']]),
  works: new Map(),
}

/** La liste par défaut, avec les valeurs voulues par le test. */
const listOf = (overrides: Partial<AdminListQuery> = {}): AdminListQuery => ({
  ...parseAdminListQuery({}),
  ...overrides,
})

describe('liste du catalogue dans l’adresse', () => {
  it('lit les valeurs valides et ignore les autres', () => {
    expect(
      parseAdminListQuery({ kind: 'people', scope: 'archived', q: ' léa ', page: '3' }),
    ).toEqual(listOf({ kind: 'people', scope: 'archived', q: 'léa', page: 3 }))
    expect(
      parseAdminListQuery({
        kind: 'x',
        scope: 'y',
        page: '-2',
        type: 'novel',
        status: 'x',
        format: 'A B',
        sort: 'random',
      }),
    ).toEqual(listOf())
    expect(parseAdminListQuery({ kind: ['publishers', 'works'] }).kind).toBe('publishers')
  })

  it('lit les filtres à plusieurs valeurs et le tri', () => {
    expect(
      parseAdminListQuery({
        type: 'oneshot',
        status: 'ongoing,completed',
        format: 'manga,webtoon',
        sort: 'completeness',
      }),
    ).toEqual(
      listOf({
        type: ['oneshot'],
        status: ['ongoing', 'completed'],
        format: ['manga', 'webtoon'],
        sort: 'completeness',
      }),
    )
  })

  it('écarte les valeurs de filtre inconnues, en double ou en trop', () => {
    const many = Array.from({ length: 12 }, (_, index) => `f${index}`).join(',')

    expect(
      parseAdminListQuery({ type: 'series,novel,series', format: `A B,${many}` }),
    ).toMatchObject({
      type: ['series'],
      format: many.split(',').slice(0, 10),
    })
  })

  it('n’écrit pas les valeurs par défaut', () => {
    expect(toAdminRouteQuery(listOf())).toEqual({})
    expect(toAdminRouteQuery(listOf({ kind: 'people', scope: 'all', q: 'a', page: 2 }))).toEqual({
      kind: 'people',
      scope: 'all',
      q: 'a',
      page: '2',
    })
    expect(toAdminRouteQuery(listOf({ type: ['series', 'oneshot'], sort: 'title_desc' }))).toEqual({
      type: 'series,oneshot',
      sort: 'title_desc',
    })
  })

  it('prépare la requête de l’API, filtres et tri pour les œuvres seulement', () => {
    expect(toAdminApiQuery(listOf({ scope: 'all', page: 2, format: ['manga', 'bd'] }), 20)).toEqual(
      {
        q: undefined,
        scope: 'all',
        page: 2,
        pageSize: 20,
        sort: 'title',
        type: undefined,
        status: undefined,
        format: 'manga,bd',
      },
    )
    expect(toAdminApiQuery(listOf({ kind: 'people', format: ['manga'] }), 20)).toEqual({
      q: undefined,
      scope: 'active',
      page: 1,
      pageSize: 20,
    })
  })

  it('compte les pages et nomme les lignes', () => {
    expect(pageCount({ items: [], page: 1, pageSize: 20, total: 0 })).toBe(1)
    expect(pageCount({ items: [], page: 1, pageSize: 20, total: 41 })).toBe(3)
    expect(itemLabel({ id: 1, archived: false, title: 'Titre' })).toBe('Titre')
    expect(itemLabel({ id: 1, archived: false, name: 'Nom' })).toBe('Nom')
    expect(itemLabel({ id: 7, archived: false })).toBe('#7')
  })
})

describe('onglets du catalogue', () => {
  const list = listOf({ kind: 'people', q: 'a', page: 3, type: ['series'], sort: 'completeness' })

  it('reconnaît l’onglet affiché', () => {
    expect(tabOf(list)).toBe('people')
    expect(tabOf({ ...list, scope: 'archived' })).toBe('archives')
    expect(tabOf({ ...list, scope: 'all' })).toBe('people')
  })

  it('un onglet de type montre les fiches publiées, Archives garde le type', () => {
    expect(queryForTab({ ...list, scope: 'archived' }, 'works')).toEqual(listOf({ kind: 'works' }))
    expect(queryForTab(list, 'archives')).toEqual(listOf({ kind: 'people', scope: 'archived' }))
  })

  it('chaque onglet repart d’une recherche, de filtres et d’un tri vides', () => {
    const next = queryForTab(list, 'publishers')

    expect(next).toMatchObject({ q: '', type: [], sort: 'title', page: 1 })
  })
})

describe('section de la fiche œuvre', () => {
  it('lit la section de l’adresse, sinon ouvre la première', () => {
    expect(parseWorkSection('links')).toBe('links')
    expect(parseWorkSection('inconnue')).toBe('info')
    expect(parseWorkSection(undefined)).toBe('info')
    expect(parseWorkSection(['links'])).toBe('info')
  })
})

describe('adresse d’édition', () => {
  it('reconnaît un type et un identifiant, ou « new »', () => {
    expect(parseAdminEditRoute({ kind: 'works', id: '12' })).toEqual({ kind: 'works', id: 12 })
    expect(parseAdminEditRoute({ kind: 'people', id: 'new' })).toEqual({
      kind: 'people',
      id: 'new',
    })
    expect(parseAdminEditRoute({ kind: 'genres', id: '1' })).toBeNull()
    expect(parseAdminEditRoute({ kind: 'works', id: '0' })).toBeNull()
    expect(parseAdminEditRoute({ kind: 'works', id: 'abc' })).toBeNull()
  })

  it('compose l’adresse', () => {
    expect(adminEditPath('works', 5)).toBe('/admin/catalogue/works/5')
    expect(adminEditPath('people', 'new')).toBe('/admin/catalogue/people/new')
  })
})

describe('formulaire œuvre', () => {
  it('remplit le brouillon avec les libellés, `#id` à défaut', () => {
    const draft = workToDraft(WORK, LABELS)
    expect(draft).toMatchObject({
      chapters: '86',
      volumes: '',
      startedOn: '2020-01-01',
      endedOn: '',
      credits: [{ person: { id: 2, label: 'Léa Auteure' }, role: 'story' }],
      publishers: [{ publisher: { id: 3, label: 'Maison Fictive' } }],
      relations: [{ work: { id: 9, label: '#9' }, relation: 'sequel' }],
      links: [{ kind: 'read', url: 'https://exemple.test', label: '' }],
    })
  })

  it('renvoie le corps d’origine après un aller-retour', () => {
    const body = draftToWorkBody(workToDraft(WORK, LABELS))
    expect(body).toMatchObject({
      title: 'Aube Fictive',
      chapters: 86,
      volumes: null,
      startedOn: '2020-01-01',
      endedOn: null,
      credits: WORK.credits,
      publisherIds: [3],
      relations: WORK.relations,
      links: WORK.links,
    })
  })

  it('garde la version lue pour le remplacement, et n’en envoie pas à la création', () => {
    expect(draftToWorkBody(workToDraft(WORK, LABELS)).updatedAt).toBe(WORK.updatedAt)
    expect(draftToWorkBody(emptyWorkDraft()).updatedAt).toBeUndefined()
  })

  it('vide les totaux d’une œuvre en cours (RG-18)', () => {
    const draft = { ...emptyWorkDraft(), title: 'X', status: 'ongoing', chapters: '5' }
    expect(draftToWorkBody(draft)).toMatchObject({ chapters: null, volumes: null })
  })

  it('ignore les lignes laissées incomplètes', () => {
    const draft = {
      ...emptyWorkDraft(),
      titles: [{ language: 'en', kind: 'short', title: '  ' }],
      synopses: [{ language: 'fr', source: 'human', text: '' }],
      credits: [{ person: null, role: 'art' }],
      publishers: [{ publisher: null }],
      relations: [{ work: null, relation: 'other' }],
      links: [{ kind: 'read', url: ' ', label: '' }],
    }
    expect(draftToWorkBody(draft)).toMatchObject({
      titles: [],
      synopses: [],
      credits: [],
      publisherIds: [],
      relations: [],
      links: [],
    })
  })
})

describe('récapitulatif d’archivage', () => {
  it('compte les membres qui suivent l’œuvre et ses relations', () => {
    expect(archiveImpact(WORK)).toEqual({ followers: 34, relations: 1 })
  })
})

describe('lignes incomplètes', () => {
  const complete = workToDraft(WORK, LABELS)

  it('accepte une fiche dont toutes les lignes sont choisies, ou vides', () => {
    expect(hasIncompleteRows(complete)).toBe(false)
    expect(hasIncompleteRows(emptyWorkDraft())).toBe(false)
  })

  it.each([
    ['un auteur sans personne', { credits: [{ person: null, role: 'art' }] }],
    ['un éditeur sans choix', { publishers: [{ publisher: null }] }],
    ['une œuvre liée sans choix', { relations: [{ work: null, relation: 'other' }] }],
    ['un libellé de lien sans adresse', { links: [{ kind: 'read', url: ' ', label: 'Lire' }] }],
  ])('signale %s', (_label, overrides) => {
    expect(hasIncompleteRows({ ...complete, ...overrides })).toBe(true)
  })

  it('laisse passer un lien entièrement vide', () => {
    const links = [{ kind: 'read', url: '', label: '' }]
    expect(hasIncompleteRows({ ...complete, links })).toBe(false)
  })
})

describe('formulaires personne et éditeur', () => {
  it('convertit les liens et l’adresse vide en null', () => {
    const person = {
      ...emptyPersonDraft(),
      name: ' Léa ',
      links: [{ kind: 'website', url: ' https://a.test ', label: ' ' }],
    }
    expect(draftToPersonBody(person)).toEqual({
      name: 'Léa',
      kind: 'person',
      links: [{ kind: 'website', url: 'https://a.test', label: null }],
    })
    expect(draftToPublisherBody({ ...emptyPublisherDraft(), name: 'M', url: '' })).toEqual({
      name: 'M',
      kind: 'publisher',
      url: null,
    })
  })

  it('remplit le brouillon depuis la fiche', () => {
    expect(
      personToDraft({
        id: 1,
        name: 'Léa',
        kind: 'collective',
        archived: false,
        activeWorkCount: 0,
        links: [{ kind: 'social', url: 'https://r.test', label: null }],
      }),
    ).toEqual({
      name: 'Léa',
      kind: 'collective',
      links: [{ kind: 'social', url: 'https://r.test', label: '' }],
    })
    expect(
      publisherToDraft({
        id: 1,
        name: 'M',
        kind: 'platform',
        url: null,
        archived: false,
        activeWorkCount: 0,
      }),
    ).toEqual({ name: 'M', kind: 'platform', url: '' })
  })
})

describe('saisie', () => {
  it('ne garde que des chiffres, en nombre limité', () => {
    expect(digitsOnly('12a-3 4')).toBe('1234')
    expect(digitsOnly('1234567')).toBe('12345')
    expect(digitsOnly('abc')).toBe('')
    expect(digitsOnly('123', 2)).toBe('12')
  })

  it('ne garde que 3 lettres minuscules pour une langue', () => {
    expect(languageCode('FR')).toBe('fr')
    expect(languageCode('j-a1p')).toBe('jap')
    expect(languageCode('fran')).toBe('fra')
  })
})

describe('divers', () => {
  it('construit les options d’un menu', () => {
    expect(optionsOf(['a', 'b'], (code) => code.toUpperCase())).toEqual([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ])
  })

  it('relève les champs refusés par l’API', () => {
    expect(
      invalidFields([{ path: ['chapters'] }, { path: ['links', 0, 'url'] }, { path: [] }, null]),
    ).toEqual(new Set(['chapters', 'links']))
    expect(invalidFields(undefined)).toEqual(new Set())
  })

  it('remplace le message de validation du pseudo par celui des formulaires', () => {
    const messageKeyFor = (error: { code: string }) => `error.${error.code}`
    expect(adminErrorKey({ status: 400, code: 'VALIDATION_ERROR' }, messageKeyFor)).toBe(
      'admin.error.validation',
    )
    expect(adminErrorKey({ status: 409, code: 'PERSON_HAS_WORKS' }, messageKeyFor)).toBe(
      'error.PERSON_HAS_WORKS',
    )
  })
})
