/** Catalogue administration: response types, form drafts and pure conversions (tested without Nuxt). */
import {
  CREDIT_ROLES,
  LINK_KINDS,
  PERSON_KINDS,
  PUBLISHER_KINDS,
  RELATION_KINDS,
  SYNOPSIS_SOURCES,
  TITLE_KINDS,
  WORK_STATUSES,
  WORK_TYPES,
} from '../contract/api'
import type { ApiError } from './api-error'

/** Kinds of administered records. */
export type AdminKind = 'works' | 'people' | 'publishers'
export const ADMIN_KINDS: readonly AdminKind[] = ['works', 'people', 'publishers']

/** Which records a list shows: published, archived or both. */
export type AdminScope = 'active' | 'archived' | 'all'
export const ADMIN_SCOPES: readonly AdminScope[] = ['active', 'archived', 'all']

// Runtime values taken from the contract. A work is read or bought (`WORK_LINK_KINDS`); the website
// and social networks belong to a person (`PERSON_LINK_KINDS`).
export { PERSON_LINK_KINDS, WORK_LINK_KINDS } from '../contract/api'
export {
  CREDIT_ROLES,
  LINK_KINDS,
  PERSON_KINDS,
  PUBLISHER_KINDS,
  RELATION_KINDS,
  SYNOPSIS_SOURCES,
  TITLE_KINDS,
  WORK_STATUSES,
  WORK_TYPES,
}

/** Sections of the work form; the first one is open by default. */
export const WORK_SECTIONS = ['info', 'texts', 'relations', 'links', 'people'] as const
export type WorkSection = (typeof WORK_SECTIONS)[number]

/** Section requested by the address; an unknown value opens the first one. */
export function parseWorkSection(value: unknown): WorkSection {
  return WORK_SECTIONS.find((section) => section === value) ?? WORK_SECTIONS[0]
}

/** A page of a paginated administration list. */
export interface AdminPage<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

/** An external link of a work or a person. */
export interface AdminLink {
  kind: (typeof LINK_KINDS)[number]
  url: string
  label: string | null
}

/** List row: a work (title, type, status…) or a person or publisher (name, kind). */
export interface AdminListItem {
  id: number
  archived: boolean
  /** Title (work) or name (person, publisher). */
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

/** Catalogue tabs: one per record kind, plus the archives of the current kind. */
export type AdminTab = AdminKind | 'archives'
export const ADMIN_TABS: readonly AdminTab[] = [...ADMIN_KINDS, 'archives']

/** The tab a list query belongs to. */
export const tabOf = (list: AdminListQuery): AdminTab =>
  list.scope === 'archived' ? 'archives' : list.kind

/** A person (creator) with their links. */
export interface AdminPerson {
  id: number
  name: string
  kind: (typeof PERSON_KINDS)[number]
  archived: boolean
  activeWorkCount: number
  links: AdminLink[]
}

/** A publisher or platform. */
export interface AdminPublisher {
  id: number
  name: string
  kind: (typeof PUBLISHER_KINDS)[number]
  url: string | null
  archived: boolean
  activeWorkCount: number
}

/** A full work record as read for editing. */
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
  /** Names of the cited people, publishers and related works (archived ones included). */
  labels: { people: RecordRef[]; publishers: RecordRef[]; works: RecordRef[] }
  followerCount: number
  /** Record version: sent back with the replacement to detect a modification in the meantime. */
  updatedAt: string
}

/** What archiving a work leaves in place, recalled in the confirmation. */
export interface ArchiveImpact {
  followers: number
  relations: number
}

/** The impact of archiving a work. */
export const archiveImpact = (work: AdminWork): ArchiveImpact => ({
  followers: work.followerCount,
  relations: work.relations.length,
})

/** A record chosen in a picker: its identifier and what is displayed for it. */
export interface RecordRef {
  id: number
  label: string
}

// --- Input: each field only accepts what the API accepts ---

/** Digits only, `max` at most (a chapter or volume total fits in 5 digits). */
export const digitsOnly = (value: string, max = 5) => value.replaceAll(/\D/g, '').slice(0, max)

/** Languages offered upfront (ISO 639 codes): European first, then Asian, in menu order. */
export const ADMIN_LANGUAGES = [
  'fr',
  'en',
  'de',
  'es',
  'it',
  'pt',
  'nl',
  'ca',
  'pl',
  'ru',
  'uk',
  'sv',
  'da',
  'no',
  'fi',
  'cs',
  'hu',
  'ro',
  'el',
  'ja',
  'ko',
  'zh',
] as const

/**
 * Options of a language menu, labelled "Français (fr)". A language already saved but missing
 * from the list (`current`) is added first so it is not lost.
 */
export function languageOptions(nameOf: (code: string) => string, current = '') {
  const codes: string[] = [...ADMIN_LANGUAGES]
  if (current && !codes.includes(current)) codes.unshift(current)
  return optionsOf(codes, (code) => `${nameOf(code)} (${code})`)
}

/** Options of a select from enumeration codes and a label function. */
export const optionsOf = (codes: readonly string[], label: (code: string) => string) =>
  codes.map((value) => ({ value, label: label(value) }))

// --- List: the address carries the tab, scope, search, filters, sort and page ---

/** Sort orders of the work list. */
export const ADMIN_WORK_SORTS = [
  'title',
  'title_desc',
  'completeness',
  'completeness_desc',
] as const
export type AdminWorkSort = (typeof ADMIN_WORK_SORTS)[number]

/** Filters of the work list; an empty list means no filter, several values mean OR. */
export interface AdminWorkFilters {
  type: string[]
  status: string[]
  format: string[]
}

/** Everything the address says about an administration list. */
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

/** First value of a query parameter (which may be repeated) as text. */
function firstValue(value: unknown): string {
  return String(Array.isArray(value) ? value[0] : (value ?? ''))
}

/** Whether the text is one of the allowed values. */
function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value)
}

/** Values of a filter (comma-separated list): unknown ones and duplicates are dropped. */
function filterValues(value: unknown, isValid: (code: string) => boolean): string[] {
  const codes = firstValue(value).split(',').filter(isValid)
  return [...new Set(codes)].slice(0, MAX_FILTER_VALUES)
}

/** Reads an administration list query from the address; invalid values fall back to defaults. */
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

/** Address parameters without the default values. */
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

/** API parameters of a list; filters and sort only exist for works. */
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

/** Switching tabs starts from an empty search and filters: each tab searches on its own. */
export function queryForTab(list: AdminListQuery, tab: AdminTab): AdminListQuery {
  const next = { ...list, ...NO_FILTERS, q: '', sort: 'title' as const, page: 1 }
  return tab === 'archives'
    ? { ...next, scope: 'archived' }
    : { ...next, kind: tab, scope: 'active' }
}

/** Records per page of an administration list. */
export const ADMIN_PAGE_SIZE = 20

/** Number of pages of a list, at least one. */
export const pageCount = (page: AdminPage<unknown>) =>
  Math.max(1, Math.ceil(page.total / page.pageSize))

/** Text shown for a list row: its title or name, otherwise its identifier. */
export const itemLabel = (item: AdminListItem) => item.title ?? item.name ?? `#${item.id}`

// --- Work form: text in the fields, API body as output ---

/** The work form content, kept as text so fields can be edited freely. */
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
  /** Version of the open record; empty for a new one. */
  updatedAt: string
}

/** The draft of a new work. */
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

/** Text of a value, empty for null. */
const textOrEmpty = (value: string | number | null) => (value === null ? '' : String(value))
/** Trimmed text, or null when empty. */
const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim())
/** Trimmed text, or undefined when empty. */
const textOrUndefined = (value: string) => textOrNull(value) ?? undefined
/** Number from a text, or null when empty. */
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

/** Picker choice for `id`; without a known name, falls back to `#id`. */
const refOf = (labels: RecordRef[], id: number): RecordRef =>
  labels.find((ref) => ref.id === id) ?? { id, label: `#${id}` }

/** Converts a work record into a form draft. */
export function workToDraft(work: AdminWork): WorkDraft {
  const { labels } = work
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

/** Error shown when saving is refused because of `hasIncompleteRows`. */
export const INCOMPLETE_ROWS_ERROR_KEY = 'admin.error.incompleteRows'

/**
 * Whether a credit, publisher or related-work row has no record chosen, or a link has a label but
 * no address: `draftToWorkBody` would ignore them and the input would be lost silently.
 */
export function hasIncompleteRows(draft: WorkDraft): boolean {
  return incompleteSections(draft).length > 0
}

/** The sections of the form that contain an incomplete row (rule of `hasIncompleteRows`). */
export function incompleteSections(draft: WorkDraft): WorkSection[] {
  const isIncomplete: Record<WorkSection, boolean> = {
    info: false,
    texts: false,
    relations: draft.relations.some((row) => row.work === null),
    links: draft.links.some((row) => row.url.trim() === '' && row.label.trim() !== ''),
    people:
      draft.credits.some((row) => row.person === null) ||
      draft.publishers.some((row) => row.publisher === null),
  }
  return WORK_SECTIONS.filter((section) => isIncomplete[section])
}

// A row counts as filled in when removing it would lose something: it then asks for confirmation.
/** Whether the text has content once trimmed. */
const hasText = (value: string) => value.trim() !== ''

/** Whether a title row has text. */
export const isTitleRowFilled = (row: WorkDraft['titles'][number]) => hasText(row.title)
/** Whether a synopsis row has text. */
export const isSynopsisRowFilled = (row: WorkDraft['synopses'][number]) => hasText(row.text)
/** Whether a credit row has a person chosen. */
export const isCreditRowFilled = (row: WorkDraft['credits'][number]) => row.person !== null
/** Whether a publisher row has a publisher chosen. */
export const isPublisherRowFilled = (row: WorkDraft['publishers'][number]) => row.publisher !== null
/** Whether a relation row has a work chosen. */
export const isRelationRowFilled = (row: WorkDraft['relations'][number]) => row.work !== null
/** Whether a link row has an address or a label. */
export const isLinkRowFilled = (row: WorkDraft['links'][number]) =>
  hasText(row.url) || hasText(row.label)

/** Body to create or replace a work; rows left empty are ignored. */
export function draftToWorkBody(draft: WorkDraft) {
  const ongoing = draft.status === 'ongoing'
  return {
    updatedAt: textOrUndefined(draft.updatedAt),
    title: draft.title.trim(),
    originalLanguage: draft.originalLanguage.trim(),
    type: draft.type,
    status: draft.status,
    // Totals stay empty while the work is ongoing.
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

// --- People and publishers ---

/** The person form content. */
export interface PersonDraft {
  name: string
  kind: string
  links: { kind: string; url: string; label: string }[]
}

/** The publisher form content. */
export interface PublisherDraft {
  name: string
  kind: string
  url: string
}

/** The draft of a new person. */
export const emptyPersonDraft = (): PersonDraft => ({ name: '', kind: 'person', links: [] })
/** The draft of a new publisher. */
export const emptyPublisherDraft = (): PublisherDraft => ({
  name: '',
  kind: 'publisher',
  url: '',
})

/** Converts a person record into a form draft. */
export const personToDraft = (person: AdminPerson): PersonDraft => ({
  name: person.name,
  kind: person.kind,
  links: person.links.map((link) => ({ ...link, label: link.label ?? '' })),
})

/** Converts a publisher record into a form draft. */
export const publisherToDraft = (publisher: AdminPublisher): PublisherDraft => ({
  name: publisher.name,
  kind: publisher.kind,
  url: publisher.url ?? '',
})

/** Links of a draft as API body items; rows without an address are dropped. */
const linksBody = (links: PersonDraft['links']) =>
  links
    .filter((row) => row.url.trim() !== '')
    .map((row) => ({ kind: row.kind, url: row.url.trim(), label: textOrNull(row.label) }))

/** Body to create or replace a person. */
export const draftToPersonBody = (draft: PersonDraft) => ({
  name: draft.name.trim(),
  kind: draft.kind,
  links: linksBody(draft.links),
})

/** Body to create or replace a publisher. */
export const draftToPublisherBody = (draft: PublisherDraft) => ({
  name: draft.name.trim(),
  kind: draft.kind,
  url: textOrNull(draft.url),
})

/** The generic validation message talks about the handle: administration forms have their own. */
export function adminErrorKey(error: unknown, messageKeyFor: (error: ApiError) => string): string {
  // `useApi().request` only throws `ApiError`s.
  const apiError = error as ApiError
  return apiError.code === 'VALIDATION_ERROR' ? 'admin.error.validation' : messageKeyFor(apiError)
}

// --- API validation errors: first path segment = field ---

/** Fields refused by the API (`details[].path[0]`), to flag them in the form. */
export function invalidFields(details: unknown[] | undefined): Set<string> {
  const fields = new Set<string>()
  for (const detail of details ?? []) {
    const path = (detail as { path?: unknown[] } | null)?.path
    if (Array.isArray(path) && typeof path[0] === 'string') fields.add(path[0])
  }
  return fields
}

/** Target of an edit address (kind and id, or `new`); `null` if it does not have the expected shape. */
export function parseAdminEditRoute(
  params: Record<string, unknown>,
): { kind: AdminKind; id: number | 'new' } | null {
  const kind = firstValue(params.kind)
  const id = firstValue(params.id)
  if (!isOneOf(ADMIN_KINDS, kind)) return null
  if (id === 'new') return { kind, id }
  return /^[1-9]\d{0,14}$/.test(id) ? { kind, id: Number(id) } : null
}

/** Edit address of a record (`new`: creation). */
export const adminEditPath = (kind: AdminKind, id: number | 'new') =>
  `/admin/catalogue/${kind}/${id}`
