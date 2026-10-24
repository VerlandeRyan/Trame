// Administration du catalogue : types des réponses de `/admin/*`, brouillons de formulaire et
// conversions pures (testées sans Nuxt).
import type { ApiError } from './api-error'

export type AdminKind = 'works' | 'people' | 'publishers'
export const ADMIN_KINDS: readonly AdminKind[] = ['works', 'people', 'publishers']

export type AdminScope = 'active' | 'archived' | 'all'
export const ADMIN_SCOPES: readonly AdminScope[] = ['active', 'archived', 'all']

export const WORK_TYPES = ['series', 'oneshot', 'anthology'] as const
export const WORK_STATUSES = ['upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned'] as const
export const PERSON_KINDS = ['person', 'collective'] as const
export const PUBLISHER_KINDS = ['publisher', 'platform', 'self_published'] as const
/** Sections de la fiche œuvre ; la première est celle d'ouverture. */
export const WORK_SECTIONS = ['info', 'texts', 'relations', 'links', 'people'] as const
export type WorkSection = (typeof WORK_SECTIONS)[number]

/** Section demandée par l'adresse ; une valeur inconnue ouvre la première. */
export function parseWorkSection(value: unknown): WorkSection {
  return WORK_SECTIONS.find((section) => section === value) ?? WORK_SECTIONS[0]
}

export const LINK_KINDS = ['read', 'buy', 'website', 'social'] as const
// Une œuvre se lit ou s'achète ; le site et les réseaux sociaux sont ceux d'une personne.
export const WORK_LINK_KINDS = ['read', 'buy'] as const
export const PERSON_LINK_KINDS = ['website', 'social'] as const
export const TITLE_KINDS = ['translated', 'international', 'former', 'short'] as const
export const SYNOPSIS_SOURCES = ['official', 'human', 'machine'] as const
export const CREDIT_ROLES = ['story', 'art', 'colors', 'other'] as const
export const RELATION_KINDS = [
  'sequel',
  'prequel',
  'spin_off',
  'side_story',
  'adaptation',
  'alternate_version',
  'shared_universe',
  'contains',
  'other',
] as const

export interface AdminPage<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface AdminLink {
  kind: (typeof LINK_KINDS)[number]
  url: string
  label: string | null
}

/** Ligne de liste : œuvre (titre, type, statut…) ou personne et éditeur (nom, nature). */
export interface AdminListItem {
  id: number
  archived: boolean
  /** Titre (œuvre) ou nom (personne, éditeur). */
  title?: string
  name?: string
  kind?: string
  type?: string
  status?: string
  formats?: string[]
  mainAuthor?: string | null
  updatedAt?: string
  archivedAt?: string | null
  archivedBy?: string | null
  completeness?: number
  activeWorkCount?: number
}

// Onglets du catalogue : un par type de fiche, plus les archives du type en cours.
export type AdminTab = AdminKind | 'archives'
export const ADMIN_TABS: readonly AdminTab[] = [...ADMIN_KINDS, 'archives']

export const tabOf = (list: AdminListQuery): AdminTab =>
  list.scope === 'archived' ? 'archives' : list.kind

export interface AdminPerson {
  id: number
  name: string
  kind: (typeof PERSON_KINDS)[number]
  archived: boolean
  activeWorkCount: number
  links: AdminLink[]
}

export interface AdminPublisher {
  id: number
  name: string
  kind: (typeof PUBLISHER_KINDS)[number]
  url: string | null
  archived: boolean
  activeWorkCount: number
}

export interface AdminWork {
  id: number
  title: string
  originalLanguage: string
  type: (typeof WORK_TYPES)[number]
  status: (typeof WORK_STATUSES)[number]
  archived: boolean
  chapters: number | null
  volumes: number | null
  startedOn: string | null
  endedOn: string | null
  titles: { language: string; kind: (typeof TITLE_KINDS)[number]; title: string }[]
  synopses: { language: string; text: string; source: (typeof SYNOPSIS_SOURCES)[number] }[]
  credits: { personId: number; role: (typeof CREDIT_ROLES)[number] }[]
  publisherIds: number[]
  genres: string[]
  relations: { relatedWorkId: number; relation: (typeof RELATION_KINDS)[number] }[]
  links: AdminLink[]
  followerCount: number
  /** Version de la fiche : renvoyée avec le remplacement pour détecter une modification entre-temps. */
  updatedAt: string
}

/** Ce que l'archivage d'une œuvre laisse en place, rappelé dans la confirmation. */
export interface ArchiveImpact {
  followers: number
  relations: number
}

export const archiveImpact = (work: AdminWork): ArchiveImpact => ({
  followers: work.followerCount,
  relations: work.relations.length,
})

/** Un enregistrement choisi dans un sélecteur : son identifiant et ce qu'on en affiche. */
export interface RecordRef {
  id: number
  label: string
}

// --- Saisie : chaque champ n'accepte que ce que l'API accepte ---

/** Chiffres seulement, `max` au plus (un total de chapitres ou de tomes tient en 5 chiffres). */
export const digitsOnly = (value: string, max = 5) => value.replaceAll(/\D/g, '').slice(0, max)

/** Code de langue ISO 639 : 2 ou 3 lettres minuscules. */
export const languageCode = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z]/g, '')
    .slice(0, 3)

/** Options d'un `UiSelect` à partir de codes d'énumération et d'une fonction de libellé. */
export const optionsOf = (codes: readonly string[], label: (code: string) => string) =>
  codes.map((value) => ({ value, label: label(value) }))

// --- Liste : l'adresse porte l'onglet, la portée, la recherche, les filtres, le tri et la page ---

export const ADMIN_WORK_SORTS = [
  'title',
  'title_desc',
  'completeness',
  'completeness_desc',
] as const
export type AdminWorkSort = (typeof ADMIN_WORK_SORTS)[number]

/** Filtres de la liste des œuvres ; une liste vide = pas de filtre, plusieurs valeurs = OU. */
export interface AdminWorkFilters {
  type: string[]
  status: string[]
  format: string[]
}

export interface AdminListQuery extends AdminWorkFilters {
  kind: AdminKind
  scope: AdminScope
  q: string
  sort: AdminWorkSort
  page: number
}

const FILTER_NAMES = ['type', 'status', 'format'] as const
const NO_FILTERS: AdminWorkFilters = { type: [], status: [], format: [] }
const FORMAT_CODE = /^[a-z0-9]+(_[a-z0-9]+)*$/
const MAX_FILTER_VALUES = 10

function firstValue(value: unknown): string {
  return String(Array.isArray(value) ? value[0] : (value ?? ''))
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value)
}

/** Valeurs d'un filtre (liste séparée par des virgules) : les inconnues et les doublons sont écartés. */
function filterValues(value: unknown, isValid: (code: string) => boolean): string[] {
  const codes = firstValue(value).split(',').filter(isValid)
  return [...new Set(codes)].slice(0, MAX_FILTER_VALUES)
}

export function parseAdminListQuery(query: Record<string, unknown>): AdminListQuery {
  const kind = firstValue(query.kind)
  const scope = firstValue(query.scope)
  const sort = firstValue(query.sort)
  const page = Number.parseInt(firstValue(query.page), 10)
  return {
    kind: isOneOf(ADMIN_KINDS, kind) ? kind : 'works',
    scope: isOneOf(ADMIN_SCOPES, scope) ? scope : 'active',
    q: firstValue(query.q).trim(),
    type: filterValues(query.type, (code) => isOneOf(WORK_TYPES, code)),
    status: filterValues(query.status, (code) => isOneOf(WORK_STATUSES, code)),
    format: filterValues(query.format, (code) => FORMAT_CODE.test(code)),
    sort: isOneOf(ADMIN_WORK_SORTS, sort) ? sort : 'title',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/** Paramètres d'adresse sans les valeurs par défaut. */
export function toAdminRouteQuery(list: AdminListQuery): Record<string, string> {
  const query: Record<string, string> = {}
  if (list.kind !== 'works') query.kind = list.kind
  if (list.scope !== 'active') query.scope = list.scope
  if (list.q) query.q = list.q
  for (const filter of FILTER_NAMES) {
    if (list[filter].length > 0) query[filter] = list[filter].join(',')
  }
  if (list.sort !== 'title') query.sort = list.sort
  if (list.page > 1) query.page = String(list.page)
  return query
}

/** Filtres et tri n'existent que pour les œuvres. */
export function toAdminApiQuery(list: AdminListQuery, pageSize: number) {
  const base = { q: list.q || undefined, scope: list.scope, page: list.page, pageSize }
  if (list.kind !== 'works') return base
  return {
    ...base,
    sort: list.sort,
    type: list.type.join(',') || undefined,
    status: list.status.join(',') || undefined,
    format: list.format.join(',') || undefined,
  }
}

/** Changer d'onglet repart d'une recherche et de filtres vides : chaque onglet cherche à part. */
export function queryForTab(list: AdminListQuery, tab: AdminTab): AdminListQuery {
  const next = { ...list, ...NO_FILTERS, q: '', sort: 'title' as const, page: 1 }
  return tab === 'archives'
    ? { ...next, scope: 'archived' }
    : { ...next, kind: tab, scope: 'active' }
}

export const ADMIN_PAGE_SIZE = 20

export const pageCount = (page: AdminPage<unknown>) =>
  Math.max(1, Math.ceil(page.total / page.pageSize))

export const itemLabel = (item: AdminListItem) => item.title ?? item.name ?? `#${item.id}`

// --- Formulaire œuvre : textes dans les champs, corps d'API en sortie ---

export interface WorkDraft {
  title: string
  originalLanguage: string
  type: string
  status: string
  chapters: string
  volumes: string
  startedOn: string
  endedOn: string
  titles: { language: string; kind: string; title: string }[]
  synopses: { language: string; source: string; text: string }[]
  credits: { person: RecordRef | null; role: string }[]
  publishers: { publisher: RecordRef | null }[]
  genres: string[]
  relations: { work: RecordRef | null; relation: string }[]
  links: { kind: string; url: string; label: string }[]
  /** Version de la fiche ouverte ; vide pour une fiche neuve. */
  updatedAt: string
}

export function emptyWorkDraft(): WorkDraft {
  return {
    updatedAt: '',
    title: '',
    originalLanguage: 'fr',
    type: 'series',
    status: 'ongoing',
    chapters: '',
    volumes: '',
    startedOn: '',
    endedOn: '',
    titles: [],
    synopses: [],
    credits: [],
    publishers: [],
    genres: [],
    relations: [],
    links: [],
  }
}

const textOrEmpty = (value: string | number | null) => (value === null ? '' : String(value))
const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim())
const textOrUndefined = (value: string) => textOrNull(value) ?? undefined
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

/** Libellés des enregistrements cités par une œuvre, pour remplir les sélecteurs. */
export interface WorkLabels {
  people: Map<number, string>
  publishers: Map<number, string>
  works: Map<number, string>
}

const refOf = (labels: Map<number, string>, id: number): RecordRef => ({
  id,
  label: labels.get(id) ?? `#${id}`,
})

export function workToDraft(work: AdminWork, labels: WorkLabels): WorkDraft {
  return {
    title: work.title,
    originalLanguage: work.originalLanguage,
    type: work.type,
    status: work.status,
    chapters: textOrEmpty(work.chapters),
    volumes: textOrEmpty(work.volumes),
    startedOn: textOrEmpty(work.startedOn),
    endedOn: textOrEmpty(work.endedOn),
    titles: work.titles.map((title) => ({ ...title })),
    synopses: work.synopses.map((synopsis) => ({ ...synopsis })),
    credits: work.credits.map(({ personId, role }) => ({
      person: refOf(labels.people, personId),
      role,
    })),
    publishers: work.publisherIds.map((id) => ({ publisher: refOf(labels.publishers, id) })),
    genres: [...work.genres],
    relations: work.relations.map(({ relatedWorkId, relation }) => ({
      work: refOf(labels.works, relatedWorkId),
      relation,
    })),
    links: work.links.map((link) => ({ ...link, label: link.label ?? '' })),
    updatedAt: work.updatedAt,
  }
}

/**
 * Une ligne d'auteur, d'éditeur ou d'œuvre liée sans fiche choisie, ou un lien avec libellé mais
 * sans adresse : `draftToWorkBody` les ignorerait, la saisie serait perdue sans un mot.
 */
export function hasIncompleteRows(draft: WorkDraft): boolean {
  return (
    draft.credits.some((row) => row.person === null) ||
    draft.publishers.some((row) => row.publisher === null) ||
    draft.relations.some((row) => row.work === null) ||
    draft.links.some((row) => row.url.trim() === '' && row.label.trim() !== '')
  )
}

/** Corps de `PUT/POST /admin/works` ; les lignes laissées vides sont ignorées. */
export function draftToWorkBody(draft: WorkDraft) {
  const ongoing = draft.status === 'ongoing'
  return {
    updatedAt: textOrUndefined(draft.updatedAt),
    title: draft.title.trim(),
    originalLanguage: draft.originalLanguage.trim(),
    type: draft.type,
    status: draft.status,
    // RG-18 : les totaux restent vides tant que l'œuvre est en cours.
    chapters: ongoing ? null : numberOrNull(draft.chapters),
    volumes: ongoing ? null : numberOrNull(draft.volumes),
    startedOn: textOrNull(draft.startedOn),
    endedOn: textOrNull(draft.endedOn),
    titles: draft.titles
      .filter((row) => row.title.trim() !== '')
      .map((row) => ({ ...row, title: row.title.trim() })),
    synopses: draft.synopses
      .filter((row) => row.text.trim() !== '')
      .map((row) => ({ ...row, text: row.text.trim() })),
    credits: draft.credits.flatMap((row) =>
      row.person ? [{ personId: row.person.id, role: row.role }] : [],
    ),
    publisherIds: draft.publishers.flatMap((row) => (row.publisher ? [row.publisher.id] : [])),
    genres: draft.genres,
    relations: draft.relations.flatMap((row) =>
      row.work ? [{ relatedWorkId: row.work.id, relation: row.relation }] : [],
    ),
    links: draft.links
      .filter((row) => row.url.trim() !== '')
      .map((row) => ({ kind: row.kind, url: row.url.trim(), label: textOrNull(row.label) })),
  }
}

// --- Personnes, éditeurs ---

export interface PersonDraft {
  name: string
  kind: string
  links: { kind: string; url: string; label: string }[]
}

export interface PublisherDraft {
  name: string
  kind: string
  url: string
}

export const emptyPersonDraft = (): PersonDraft => ({ name: '', kind: 'person', links: [] })
export const emptyPublisherDraft = (): PublisherDraft => ({
  name: '',
  kind: 'publisher',
  url: '',
})

export const personToDraft = (person: AdminPerson): PersonDraft => ({
  name: person.name,
  kind: person.kind,
  links: person.links.map((link) => ({ ...link, label: link.label ?? '' })),
})

export const publisherToDraft = (publisher: AdminPublisher): PublisherDraft => ({
  name: publisher.name,
  kind: publisher.kind,
  url: publisher.url ?? '',
})

const linksBody = (links: PersonDraft['links']) =>
  links
    .filter((row) => row.url.trim() !== '')
    .map((row) => ({ kind: row.kind, url: row.url.trim(), label: textOrNull(row.label) }))

export const draftToPersonBody = (draft: PersonDraft) => ({
  name: draft.name.trim(),
  kind: draft.kind,
  links: linksBody(draft.links),
})

export const draftToPublisherBody = (draft: PublisherDraft) => ({
  name: draft.name.trim(),
  kind: draft.kind,
  url: textOrNull(draft.url),
})

/** `error.VALIDATION_ERROR` parle du pseudo : les formulaires d'administration ont leur message. */
export function adminErrorKey(error: unknown, messageKeyFor: (error: ApiError) => string): string {
  // `useApi().request` ne lève que des `ApiError`.
  const apiError = error as ApiError
  return apiError.code === 'VALIDATION_ERROR' ? 'admin.error.validation' : messageKeyFor(apiError)
}

// --- Erreurs de validation de l'API : premier segment du chemin = champ ---

/** Champs refusés par l'API (`details[].path[0]`), pour les signaler dans le formulaire. */
export function invalidFields(details: unknown[] | undefined): Set<string> {
  const fields = new Set<string>()
  for (const detail of details ?? []) {
    const path = (detail as { path?: unknown[] } | null)?.path
    if (Array.isArray(path) && typeof path[0] === 'string') fields.add(path[0])
  }
  return fields
}

/** Cible d'une adresse `/admin/catalogue/{kind}/{id}` ; `null` si elle n'a pas la forme attendue. */
export function parseAdminEditRoute(
  params: Record<string, unknown>,
): { kind: AdminKind; id: number | 'new' } | null {
  const kind = firstValue(params.kind)
  const id = firstValue(params.id)
  if (!isOneOf(ADMIN_KINDS, kind)) return null
  if (id === 'new') return { kind, id }
  return /^[1-9]\d{0,14}$/.test(id) ? { kind, id: Number(id) } : null
}

/** Adresse d'édition d'une fiche (`new` : création). */
export const adminEditPath = (kind: AdminKind, id: number | 'new') =>
  `/admin/catalogue/${kind}/${id}`
