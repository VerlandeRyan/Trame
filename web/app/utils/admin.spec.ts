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
  hasUnsavableDraft,
  formatCodesOf,
  hasIncompleteForm,
  hasInvalidLinkUrl,
  incompleteSections,
  isBlank,
  isHttpsUrl,
  URL_MAX_LENGTH,
  urlErrorKey,
  missingWorkFields,
  isCreditRowFilled,
  isLinkRowFilled,
  isPublisherRowFilled,
  isRelationRowFilled,
  isSynopsisRowFilled,
  isTitleRowFilled,
  invalidFields,
  itemLabel,
  ADMIN_LANGUAGES,
  languageOptions,
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
} from './admin'

const WORK: AdminWork = {
  id: 4,
  title: 'Aube Fictive',
  originalLanguage: 'fr',
  type: 'series',
  status: 'completed',
  lifecycle: 'published',
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
  labels: {
    people: [{ id: 2, label: 'Léa Auteure' }],
    publishers: [{ id: 3, label: 'Maison Fictive' }],
    works: [],
  },
  followerCount: 34,
  updatedAt: '2026-10-24T10:00:00.000Z',
}

/** La liste par défaut, avec les valeurs voulues par le test. */
const listOf = (overrides: Partial<AdminListQuery> = {}): AdminListQuery => ({
  ...parseAdminListQuery({}),
  ...overrides,
})

describe('liste du catalogue dans l’adresse', () => {
  it('lit les valeurs valides et ignore les autres', () => {
    expect(
      parseAdminListQuery({ kind: 'people', lifecycle: 'archived', q: ' léa ', page: '3' }),
    ).toEqual(listOf({ kind: 'people', lifecycle: 'archived', q: 'léa', page: 3 }))
    expect(
      parseAdminListQuery({
        kind: 'x',
        lifecycle: 'y',
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
    expect(
      toAdminRouteQuery(listOf({ kind: 'people', lifecycle: 'published', q: 'a', page: 2 })),
    ).toEqual({
      kind: 'people',
      lifecycle: 'published',
      q: 'a',
      page: '2',
    })
    expect(toAdminRouteQuery(listOf({ type: ['series', 'oneshot'], sort: 'title_desc' }))).toEqual({
      type: 'series,oneshot',
      sort: 'title_desc',
    })
  })

  it('prépare la requête de l’API, filtres et tri pour les œuvres seulement', () => {
    expect(
      toAdminApiQuery(listOf({ lifecycle: 'draft', page: 2, format: ['manga', 'bd'] }), 20),
    ).toEqual({
      q: undefined,
      lifecycle: 'draft',
      page: 2,
      pageSize: 20,
      sort: 'title',
      type: undefined,
      status: undefined,
      format: 'manga,bd',
    })
    expect(toAdminApiQuery(listOf({ kind: 'people', format: ['manga'] }), 20)).toEqual({
      q: undefined,
      lifecycle: 'active',
      page: 1,
      pageSize: 20,
    })
  })

  it('porte le cycle de vie dans l’adresse et revient à « tous » en changeant d’onglet', () => {
    expect(parseAdminListQuery({ lifecycle: 'draft' }).lifecycle).toBe('draft')
    expect(parseAdminListQuery({ lifecycle: 'x' }).lifecycle).toBe('active')
    expect(toAdminRouteQuery(listOf({ lifecycle: 'draft' }))).toEqual({ lifecycle: 'draft' })
    expect(queryForTab(listOf({ lifecycle: 'draft' }), 'people').lifecycle).toBe('active')
  })

  it('un brouillon n’exige que le titre et des adresses valides', () => {
    const draft = { ...emptyWorkDraft(), title: 'Aube' }
    expect(hasUnsavableDraft(draft)).toBe(false)
    expect(hasUnsavableDraft({ ...draft, title: ' ' })).toBe(true)
    const link = { kind: 'read', url: 'http://non-https.example', label: '' }
    expect(hasUnsavableDraft({ ...draft, links: [link] })).toBe(true)
    expect(hasUnsavableDraft({ ...draft, links: [{ ...link, url: '' }] })).toBe(false)
  })

  it('compte les pages et nomme les lignes', () => {
    expect(pageCount({ items: [], page: 1, pageSize: 20, total: 0 })).toBe(1)
    expect(pageCount({ items: [], page: 1, pageSize: 20, total: 41 })).toBe(3)
    expect(itemLabel({ id: 1, lifecycle: 'published', title: 'Titre' })).toBe('Titre')
    expect(itemLabel({ id: 1, lifecycle: 'published', name: 'Nom' })).toBe('Nom')
    expect(itemLabel({ id: 7, lifecycle: 'published' })).toBe('#7')
  })
})

describe('onglets du catalogue', () => {
  const list = listOf({ kind: 'people', q: 'a', page: 3, type: ['series'], sort: 'completeness' })

  it('reconnaît l’onglet affiché', () => {
    expect(tabOf(list)).toBe('people')
    expect(tabOf({ ...list, lifecycle: 'archived' })).toBe('archives')
    expect(tabOf({ ...list, lifecycle: 'draft' })).toBe('people')
  })

  it('un onglet de type montre les fiches publiées, Archives garde le type', () => {
    expect(queryForTab({ ...list, lifecycle: 'archived' }, 'works')).toEqual(
      listOf({ kind: 'works' }),
    )
    expect(queryForTab(list, 'archives')).toEqual(listOf({ kind: 'people', lifecycle: 'archived' }))
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
    const draft = workToDraft(WORK)
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
    const body = draftToWorkBody(workToDraft(WORK))
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
    expect(draftToWorkBody(workToDraft(WORK)).updatedAt).toBe(WORK.updatedAt)
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

describe('champs obligatoires', () => {
  const FORMATS = ['manga', 'bd']

  it('repère le titre vide et l’absence de format', () => {
    expect(missingWorkFields(emptyWorkDraft(), FORMATS)).toEqual({
      title: true,
      formats: true,
      credits: true,
      publishers: true,
      synopsis: true,
    })
    const filled = {
      ...emptyWorkDraft(),
      title: ' Aube ',
      genres: ['fantasy', 'bd'],
      credits: [{ person: { id: 1, label: 'Léa' }, role: 'story' }],
      publishers: [{ publisher: { id: 2, label: 'Maison' } }],
      synopses: [{ language: 'fr', source: 'official', text: 'Résumé.' }],
    }
    expect(missingWorkFields(filled, FORMATS)).toEqual({
      title: false,
      formats: false,
      credits: false,
      publishers: false,
      synopsis: false,
    })
  })

  it('le synopsis doit être dans la langue originale', () => {
    const draft = {
      ...emptyWorkDraft(),
      originalLanguage: 'fr',
      synopses: [{ language: 'en', source: 'official', text: 'Summary.' }],
    }
    expect(missingWorkFields(draft, FORMATS).synopsis).toBe(true)
  })

  it('un genre thématique ne tient pas lieu de format', () => {
    const draft = { ...emptyWorkDraft(), title: 'Aube', genres: ['fantasy'] }
    expect(missingWorkFields(draft, FORMATS).formats).toBe(true)
  })

  it('ne réclame pas de format quand le catalogue n’en propose aucun', () => {
    expect(missingWorkFields(emptyWorkDraft(), []).formats).toBe(false)
  })

  it('distingue les formats des genres thématiques', () => {
    const genres = [
      { code: 'manga', category: 'format' },
      { code: 'fantasy', category: 'theme' },
    ]
    expect(formatCodesOf(genres)).toEqual(['manga'])
  })

  it('isBlank ignore les espaces', () => {
    expect(isBlank('  ')).toBe(true)
    expect(isBlank(' a ')).toBe(false)
  })
})

describe('lignes incomplètes', () => {
  const FORMATS = ['manga', 'bd']
  const complete = { ...workToDraft(WORK), genres: ['manga'] }

  it('accepte une fiche complète dont toutes les lignes sont choisies, ou vides', () => {
    expect(hasIncompleteForm(complete, FORMATS)).toBe(false)
  })

  it('signale le titre ou le format manquant, dans la section « info »', () => {
    expect(hasIncompleteForm(emptyWorkDraft(), FORMATS)).toBe(true)
    expect(incompleteSections({ ...complete, title: ' ' }, FORMATS)).toEqual(['info'])
    expect(incompleteSections({ ...complete, genres: [] }, FORMATS)).toEqual(['info'])
  })

  it.each([
    ['un auteur sans personne', { credits: [{ person: null, role: 'art' }] }],
    ['un éditeur sans choix', { publishers: [{ publisher: null }] }],
    ['une œuvre liée sans choix', { relations: [{ work: null, relation: 'other' }] }],
    ['un libellé de lien sans adresse', { links: [{ kind: 'read', url: ' ', label: 'Lire' }] }],
  ])('signale %s', (_label, overrides) => {
    expect(hasIncompleteForm({ ...complete, ...overrides }, FORMATS)).toBe(true)
  })

  it.each([
    ['un auteur sans personne', { credits: [{ person: null, role: 'art' }] }, ['people']],
    ['un éditeur sans choix', { publishers: [{ publisher: null }] }, ['people']],
    [
      'une œuvre liée sans choix',
      { relations: [{ work: null, relation: 'other' }] },
      ['relations'],
    ],
    ['un lien sans adresse', { links: [{ kind: 'read', url: '', label: 'Lire' }] }, ['links']],
  ])('place %s dans sa section', (_label, overrides, sections) => {
    expect(incompleteSections({ ...complete, ...overrides }, FORMATS)).toEqual(sections)
  })

  it('ne signale aucune section pour une fiche complète', () => {
    expect(incompleteSections(complete, FORMATS)).toEqual([])
  })

  it('une ligne existante doit avoir ses champs obligatoires, même entièrement vide', () => {
    const links = [{ kind: 'read', url: '', label: '' }]
    expect(incompleteSections({ ...complete, links }, FORMATS)).toEqual(['links'])
    const titles = [{ language: 'en', kind: 'international', title: ' ' }]
    expect(incompleteSections({ ...complete, titles }, FORMATS)).toEqual(['texts'])
    const synopses = [{ language: 'fr', source: 'official', text: '' }]
    expect(incompleteSections({ ...complete, synopses }, FORMATS)).toEqual(['texts'])
  })

  it('ne signale pas les lignes dont les champs obligatoires sont remplis', () => {
    const filled = {
      ...complete,
      titles: [{ language: 'en', kind: 'international', title: 'Dawn' }],
      synopses: [{ language: 'fr', source: 'official', text: 'Un résumé.' }],
      links: [{ kind: 'read', url: 'https://exemple.test', label: '' }],
    }
    expect(incompleteSections(filled, FORMATS)).toEqual([])
  })

  it('repère un lien sans adresse ou à l’adresse invalide', () => {
    expect(hasInvalidLinkUrl([{ url: 'https://exemple.test' }, { url: ' ' }])).toBe(true)
    expect(hasInvalidLinkUrl([{ url: 'http://exemple.test' }])).toBe(true)
    expect(hasInvalidLinkUrl([{ url: 'https://exemple.test' }])).toBe(false)
    expect(hasInvalidLinkUrl([])).toBe(false)
  })

  it('signale dans l’onglet « Liens » une adresse mal formée', () => {
    const links = [{ kind: 'read', url: 'exemple.test', label: '' }]
    expect(incompleteSections({ ...complete, links }, FORMATS)).toEqual(['links'])
  })
})

describe('adresses https', () => {
  it.each([
    ['https://exemple.test', true],
    ['  https://exemple.test/chemin?q=1#haut ', true],
    ['HTTPS://Exemple.test', true],
    ['http://exemple.test', false],
    ['exemple.test', false],
    ['https://', false],
    ['https:/exemple.test', false],
    ['ftp://exemple.test', false],
    ['', false],
    [`https://exemple.test/${'a'.repeat(URL_MAX_LENGTH)}`, false],
  ])('isHttpsUrl(%j) = %s', (value, expected) => {
    expect(isHttpsUrl(value)).toBe(expected)
  })

  it('donne la clé d’erreur d’une adresse : vide si obligatoire, ou invalide', () => {
    expect(urlErrorKey('', true)).toBe('admin.error.required')
    expect(urlErrorKey('  ', false)).toBeUndefined()
    expect(urlErrorKey('exemple.test', false)).toBe('admin.error.invalidUrl')
    expect(urlErrorKey('https://exemple.test', true)).toBeUndefined()
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

  it('renvoie la version lue, et aucune pour une nouvelle fiche', () => {
    const version = '2026-10-24T10:00:00.000Z'
    expect(draftToPersonBody({ ...emptyPersonDraft(), updatedAt: version }).updatedAt).toBe(version)
    expect(draftToPublisherBody({ ...emptyPublisherDraft(), updatedAt: version }).updatedAt).toBe(
      version,
    )
    expect(draftToPersonBody(emptyPersonDraft()).updatedAt).toBeUndefined()
    expect(draftToPublisherBody(emptyPublisherDraft()).updatedAt).toBeUndefined()
  })

  it('remplit le brouillon depuis la fiche', () => {
    expect(
      personToDraft({
        id: 1,
        name: 'Léa',
        kind: 'collective',
        lifecycle: 'published',
        activeWorkCount: 0,
        links: [{ kind: 'social', url: 'https://r.test', label: null }],
        updatedAt: '2026-10-24T10:00:00.000Z',
        archivedAt: null,
        archivedBy: null,
      }),
    ).toEqual({
      name: 'Léa',
      kind: 'collective',
      links: [{ kind: 'social', url: 'https://r.test', label: '' }],
      updatedAt: '2026-10-24T10:00:00.000Z',
    })
    expect(
      publisherToDraft({
        id: 1,
        name: 'M',
        kind: 'platform',
        url: null,
        lifecycle: 'published',
        activeWorkCount: 0,
        updatedAt: '2026-10-24T10:00:00.000Z',
        archivedAt: null,
        archivedBy: null,
      }),
    ).toEqual({ name: 'M', kind: 'platform', url: '', updatedAt: '2026-10-24T10:00:00.000Z' })
  })
})

describe('saisie', () => {
  it('ne garde que des chiffres, en nombre limité', () => {
    expect(digitsOnly('12a-3 4')).toBe('1234')
    expect(digitsOnly('1234567')).toBe('12345')
    expect(digitsOnly('abc')).toBe('')
    expect(digitsOnly('123', 2)).toBe('12')
  })
})

describe('languageOptions', () => {
  const nameOf = (code: string) => code.toUpperCase()

  it('propose les langues européennes avec leur code ISO', () => {
    const options = languageOptions(nameOf)

    expect(options.map((option) => option.value)).toEqual([...ADMIN_LANGUAGES])
    expect(options[0]).toEqual({ value: 'fr', label: 'FR (fr)' })
  })

  it('garde une langue déjà enregistrée même hors de la liste', () => {
    const options = languageOptions(nameOf, 'sw')

    expect(options[0]).toEqual({ value: 'sw', label: 'SW (sw)' })
    expect(options).toHaveLength(ADMIN_LANGUAGES.length + 1)
  })

  it('n’ajoute rien pour une langue de la liste ou une valeur vide', () => {
    expect(languageOptions(nameOf, 'de')).toHaveLength(ADMIN_LANGUAGES.length)
    expect(languageOptions(nameOf, '')).toHaveLength(ADMIN_LANGUAGES.length)
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

  it('nomme la fiche introuvable plutôt qu’une erreur générique', () => {
    const messageKeyFor = () => 'error.INTERNAL_ERROR'
    expect(adminErrorKey({ status: 404, code: 'NOT_FOUND' }, messageKeyFor)).toBe(
      'admin.error.notFound',
    )
  })
})

describe('lignes saisies (confirmation avant retrait)', () => {
  const ref = { id: 1, label: 'Quelqu’un' }

  it('un titre ou un synopsis n’est saisi que s’il a du texte', () => {
    expect(isTitleRowFilled({ language: 'en', kind: 'international', title: ' ' })).toBe(false)
    expect(isTitleRowFilled({ language: 'en', kind: 'international', title: 'Mist' })).toBe(true)
    expect(isSynopsisRowFilled({ language: 'fr', source: 'official', text: '' })).toBe(false)
    expect(isSynopsisRowFilled({ language: 'fr', source: 'official', text: 'Un résumé' })).toBe(
      true,
    )
  })

  it('un auteur, un éditeur ou une œuvre liée est saisi dès qu’une fiche est choisie', () => {
    expect(isCreditRowFilled({ person: null, role: 'story' })).toBe(false)
    expect(isCreditRowFilled({ person: ref, role: 'story' })).toBe(true)
    expect(isPublisherRowFilled({ publisher: null })).toBe(false)
    expect(isPublisherRowFilled({ publisher: ref })).toBe(true)
    expect(isRelationRowFilled({ work: null, relation: 'sequel' })).toBe(false)
    expect(isRelationRowFilled({ work: ref, relation: 'sequel' })).toBe(true)
  })

  it('un lien est saisi dès qu’il a une adresse ou un libellé', () => {
    expect(isLinkRowFilled({ kind: 'read', url: ' ', label: '' })).toBe(false)
    expect(isLinkRowFilled({ kind: 'read', url: 'https://a.test', label: '' })).toBe(true)
    expect(isLinkRowFilled({ kind: 'read', url: '', label: 'Lire' })).toBe(true)
  })
})
