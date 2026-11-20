/** Catalogue administration: response types, form values and pure conversions (tested without Nuxt). */
import {
  ADMIN_LIFECYCLE_FILTERS,
  ADMIN_WORK_SORTS,
  PUBLICATION_GAPS,
  WORK_STATUSES,
  WORK_TYPES,
} from '../contract/api'
import type {
  AdminLifecycle,
  AdminPage,
  AdminPerson,
  AdminPublisher,
  AdminRecordLabel,
  AdminWork,
  ErrorCode,
  PublicationGap,
} from '../contract/api'
import type { ApiError } from './api-error'

/** Kinds of administered records. */
export type AdminKind = 'works' | 'people' | 'publishers'
export const ADMIN_KINDS: readonly AdminKind[] = ['works', 'people', 'publishers']

/** Which records a list shows: one lifecycle, or `active` for drafts and published ones together. */
export type AdminLifecycleFilter = (typeof ADMIN_LIFECYCLE_FILTERS)[number]

// Runtime values taken from the contract. A work is read or bought (`WORK_LINK_KINDS`); the website
// and social networks belong to a person (`PERSON_LINK_KINDS`).
export {
  CREDIT_ROLES,
  LINK_KINDS,
  PERSON_KINDS,
  PERSON_LINK_KINDS,
  PUBLISHER_KINDS,
  RELATION_KINDS,
  SYNOPSIS_SOURCES,
  TITLE_KINDS,
  WORK_LINK_KINDS,
} from '../contract/api'
export type { AdminLink } from '../contract/api'
export { ADMIN_LIFECYCLE_FILTERS, ADMIN_WORK_SORTS, WORK_STATUSES, WORK_TYPES }
export type { AdminLifecycle, AdminPage, PublicationGap }

/** Sections of the work form; the first one is open by default. */
export const WORK_SECTIONS = ['info', 'texts', 'relations', 'links', 'people'] as const
export type WorkSection = (typeof WORK_SECTIONS)[number]

/** Section requested by the address; an unknown value opens the first one. */
export function parseWorkSection(value: unknown): WorkSection {
  return WORK_SECTIONS.find((section) => section === value) ?? WORK_SECTIONS[0]
}

/** List row: a work (title, type, status…) or a person or publisher (name, kind). */
export interface AdminListItem {
  id: number
  lifecycle: AdminLifecycle
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
  list.lifecycle === 'archived' ? 'archives' : list.kind

// The records as read for editing: types of the contract, never copied.
export type { AdminPerson, AdminPublisher, AdminWork }

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
export interface RecordRef extends AdminRecordLabel {
  /** Not yet published: a published work cannot cite it. */
  draft?: boolean
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

// --- List: the address carries the tab, lifecycle, search, filters, sort and page ---

/** Sort order of the work list. */
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
  lifecycle: AdminLifecycleFilter
  q: string
  sort: AdminWorkSort
  page: number
}

const FILTER_NAMES = ['type', 'status', 'format'] as const
export const NO_FILTERS: AdminWorkFilters = { type: [], status: [], format: [] }
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
  const lifecycle = firstValue(query.lifecycle)
  const sort = firstValue(query.sort)
  const page = Number.parseInt(firstValue(query.page), 10)
  return {
    kind: isOneOf(ADMIN_KINDS, kind) ? kind : 'works',
    lifecycle: isOneOf(ADMIN_LIFECYCLE_FILTERS, lifecycle) ? lifecycle : 'active',
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
  if (list.lifecycle !== 'active') query.lifecycle = list.lifecycle
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
  const base = {
    q: list.q || undefined,
    lifecycle: list.lifecycle,
    page: list.page,
    pageSize,
  }
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
  const next = {
    ...list,
    ...NO_FILTERS,
    q: '',
    sort: 'title' as const,
    page: 1,
  }
  return tab === 'archives'
    ? { ...next, lifecycle: 'archived' }
    : { ...next, kind: tab, lifecycle: 'active' }
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
export interface WorkFormValues {
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

/** The form values of a new work. */
export function emptyWorkFormValues(): WorkFormValues {
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

/** Converts a work record into a form form. */
export function workToFormValues(work: AdminWork): WorkFormValues {
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

/** Error shown when saving is refused because of `hasIncompleteForm` (or an empty name). */
export const INCOMPLETE_FORM_ERROR_KEY = 'admin.error.incompleteForm'

/** Whether the text is empty once trimmed. */
export const isBlank = (value: string) => value.trim() === ''

/** Longest address the API accepts. */
export const URL_MAX_LENGTH = 2000

/** Whether the text is a full `https://` address, the only kind the API accepts. */
export function isHttpsUrl(value: string): boolean {
  const text = value.trim()
  if (text.length > URL_MAX_LENGTH || !/^https:\/\//i.test(text)) return false
  try {
    return new URL(text).hostname !== ''
  } catch {
    return false
  }
}

/** Error key of an address field: empty while required, or not a valid https address. */
export function urlErrorKey(value: string, isRequired: boolean): string | undefined {
  if (isBlank(value)) return isRequired ? 'admin.error.required' : undefined
  return isHttpsUrl(value) ? undefined : 'admin.error.invalidUrl'
}

/**
 * Whether a link row has an invalid address; an empty one counts as invalid when `isRequired`
 * (the address is required once the row exists), otherwise it is simply dropped.
 */
export const hasInvalidLinkUrl = (links: readonly { url: string }[], isRequired = true) =>
  links.some((link) => urlErrorKey(link.url, isRequired) !== undefined)

/** What a draft work cannot do without: a title, and valid addresses where some were typed. */
export const hasUnsavableDraft = (form: WorkFormValues): boolean =>
  isBlank(form.title) || hasInvalidLinkUrl(form.links, false)

/** What the record form offers: a new record, a draft or a published one. */
export type FormMode = 'create' | 'draft' | 'published'

/** What a refused save asks the form to flag: nothing, the title or name only (form), or every gap. */
export type ErrorScope = 'none' | 'title' | 'all'

/** Codes of the genres that are formats (manga, webtoon…). */
export const formatCodesOf = (genres: readonly { code: string; category: string }[]) =>
  genres.filter((genre) => genre.category === 'format').map((genre) => genre.code)

/** The section of the form where each publication gap is filled in. */
export const PUBLICATION_GAP_SECTION: Record<PublicationGap, WorkSection> = {
  genres: 'info',
  synopses: 'texts',
  credits: 'people',
  publisherIds: 'people',
}

/**
 * The publication gaps of unsaved form values, named as the API names them (the saved record's gaps
 * come from the API itself). The format is only checked when the catalogue offers formats.
 */
export function localPublicationGaps(
  form: WorkFormValues,
  formatCodes: readonly string[],
): PublicationGap[] {
  const isMissing: Record<PublicationGap, boolean> = {
    genres: formatCodes.length > 0 && !form.genres.some((code) => formatCodes.includes(code)),
    credits: !form.credits.some((row) => row.person !== null),
    publisherIds: !form.publishers.some((row) => row.publisher !== null),
    synopses: !form.synopses.some(
      (row) => row.language === form.originalLanguage && !isBlank(row.text),
    ),
  }
  return PUBLICATION_GAPS.filter((gap) => isMissing[gap])
}

/**
 * Every publication gap to flag: those of the unsaved form values, plus those the API reported
 * (`serverGaps`: its refusal, or the saved record's gaps), since the API owns the rule.
 */
export function publicationGapsOf(
  form: WorkFormValues,
  formatCodes: readonly string[],
  serverGaps: readonly PublicationGap[] = [],
): PublicationGap[] {
  const local = localPublicationGaps(form, formatCodes)
  return PUBLICATION_GAPS.filter((gap) => local.includes(gap) || serverGaps.includes(gap))
}

/**
 * Whether a required field is empty, including the required fields of a row that exists (title,
 * synopsis text, link address, credit, publisher or related work): `formValuesToWorkBody` would ignore
 * such a row and the input would be lost silently.
 */
export function hasIncompleteForm(
  form: WorkFormValues,
  formatCodes: readonly string[],
  serverGaps: readonly PublicationGap[] = [],
): boolean {
  return incompleteSections(form, formatCodes, serverGaps).length > 0
}

/** The sections of the form that contain a gap (rule of `hasIncompleteForm`). */
export function incompleteSections(
  form: WorkFormValues,
  formatCodes: readonly string[],
  serverGaps: readonly PublicationGap[] = [],
): WorkSection[] {
  const gapSections = new Set(
    publicationGapsOf(form, formatCodes, serverGaps).map((gap) => PUBLICATION_GAP_SECTION[gap]),
  )
  const isIncomplete: Record<WorkSection, boolean> = {
    info: isBlank(form.title),
    texts:
      form.titles.some((row) => isBlank(row.title)) ||
      form.synopses.some((row) => isBlank(row.text)),
    relations: form.relations.some((row) => row.work === null),
    links: hasInvalidLinkUrl(form.links),
    people:
      form.credits.some((row) => row.person === null) ||
      form.publishers.some((row) => row.publisher === null),
  }
  return WORK_SECTIONS.filter((section) => isIncomplete[section] || gapSections.has(section))
}

/** The publication gaps named by an API refusal (`VALIDATION_ERROR` details, `path[0]` = field). */
export function gapsOfRefusal(error: Pick<ApiError, 'code' | 'details'>): PublicationGap[] {
  if (error.code !== 'VALIDATION_ERROR') return []
  const paths = new Set(
    (error.details ?? []).map((issue) => (issue as { path?: unknown[] }).path?.[0]),
  )
  return PUBLICATION_GAPS.filter((gap) => paths.has(gap))
}

// A row counts as filled in when removing it would lose something: it then asks for confirmation.
/** Whether the text has content once trimmed. */
const hasText = (value: string) => !isBlank(value)

/** Whether a title row has text. */
export const isTitleRowFilled = (row: WorkFormValues['titles'][number]) => hasText(row.title)
/** Whether a synopsis row has text. */
export const isSynopsisRowFilled = (row: WorkFormValues['synopses'][number]) => hasText(row.text)
/** Whether a credit row has a person chosen. */
export const isCreditRowFilled = (row: WorkFormValues['credits'][number]) => row.person !== null
/** Whether a publisher row has a publisher chosen. */
export const isPublisherRowFilled = (row: WorkFormValues['publishers'][number]) =>
  row.publisher !== null
/** Whether a relation row has a work chosen. */
export const isRelationRowFilled = (row: WorkFormValues['relations'][number]) => row.work !== null
/** Whether a link row has an address or a label. */
export const isLinkRowFilled = (row: WorkFormValues['links'][number]) =>
  hasText(row.url) || hasText(row.label)

/** Body to create or replace a work; rows left empty are ignored. */
export function formValuesToWorkBody(form: WorkFormValues) {
  const ongoing = form.status === 'ongoing'
  return {
    updatedAt: textOrUndefined(form.updatedAt),
    title: form.title.trim(),
    originalLanguage: form.originalLanguage.trim(),
    type: form.type,
    status: form.status,
    // Totals stay empty while the work is ongoing.
    chapters: ongoing ? null : numberOrNull(form.chapters),
    volumes: ongoing ? null : numberOrNull(form.volumes),
    startedOn: textOrNull(form.startedOn),
    endedOn: textOrNull(form.endedOn),
    titles: form.titles
      .filter((row) => row.title.trim() !== '')
      .map((row) => ({ ...row, title: row.title.trim() })),
    synopses: form.synopses
      .filter((row) => row.text.trim() !== '')
      .map((row) => ({ ...row, text: row.text.trim() })),
    credits: form.credits.flatMap((row) =>
      row.person ? [{ personId: row.person.id, role: row.role }] : [],
    ),
    publisherIds: form.publishers.flatMap((row) => (row.publisher ? [row.publisher.id] : [])),
    genres: form.genres,
    relations: form.relations.flatMap((row) =>
      row.work ? [{ relatedWorkId: row.work.id, relation: row.relation }] : [],
    ),
    links: form.links
      .filter((row) => row.url.trim() !== '')
      .map((row) => ({ kind: row.kind, url: row.url.trim(), label: textOrNull(row.label) })),
  }
}

// --- People and publishers ---

/** The person form content. */
export interface PersonFormValues {
  name: string
  kind: string
  links: { kind: string; url: string; label: string }[]
  /** Version of the open record; empty for a new one. */
  updatedAt: string
}

/** The publisher form content. */
export interface PublisherFormValues {
  name: string
  kind: string
  url: string
  /** Version of the open record; empty for a new one. */
  updatedAt: string
}

/** The form values of a new person. */
export const emptyPersonFormValues = (): PersonFormValues => ({
  name: '',
  kind: 'person',
  links: [],
  updatedAt: '',
})
/** The form values of a new publisher. */
export const emptyPublisherFormValues = (): PublisherFormValues => ({
  name: '',
  kind: 'publisher',
  url: '',
  updatedAt: '',
})

/** Converts a person record into a form form. */
export const personToFormValues = (person: AdminPerson): PersonFormValues => ({
  name: person.name,
  kind: person.kind,
  links: person.links.map((link) => ({ ...link, label: link.label ?? '' })),
  updatedAt: person.updatedAt,
})

/** Converts a publisher record into a form form. */
export const publisherToFormValues = (publisher: AdminPublisher): PublisherFormValues => ({
  name: publisher.name,
  kind: publisher.kind,
  url: publisher.url ?? '',
  updatedAt: publisher.updatedAt,
})

/** Links of form values as API body items; rows without an address are dropped. */
const linksBody = (links: PersonFormValues['links']) =>
  links
    .filter((row) => row.url.trim() !== '')
    .map((row) => ({ kind: row.kind, url: row.url.trim(), label: textOrNull(row.label) }))

/** Body to create or replace a person. */
export const formValuesToPersonBody = (form: PersonFormValues) => ({
  updatedAt: textOrUndefined(form.updatedAt),
  name: form.name.trim(),
  kind: form.kind,
  links: linksBody(form.links),
})

/** Body to create or replace a publisher. */
export const formValuesToPublisherBody = (form: PublisherFormValues) => ({
  updatedAt: textOrUndefined(form.updatedAt),
  name: form.name.trim(),
  kind: form.kind,
  url: textOrNull(form.url),
})

/** Administration messages that replace the generic ones (the validation one talks about the handle). */
const ADMIN_ERROR_KEYS = new Map<ErrorCode, string>([
  ['VALIDATION_ERROR', 'admin.error.validation'],
  ['NOT_FOUND', 'admin.error.notFound'],
])

/** Key of the message shown for a refused administration write. */
export function adminErrorKey(error: unknown, messageKeyFor: (error: ApiError) => string): string {
  // `useApi().request` only throws `ApiError`s.
  const apiError = error as ApiError
  return ADMIN_ERROR_KEYS.get(apiError.code) ?? messageKeyFor(apiError)
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

/** Cache key of the catalogue list read for a query (`useAsyncData`). */
export const adminListKey = (query: AdminListQuery) => `admin-list-${JSON.stringify(query)}`

/** Cache key of the archive count shown on the "Archives" tab of a kind. */
export const adminArchivesKey = (kind: AdminKind) => `admin-list-archives-${kind}`

/** Cache key of the drafts to finish, announced above the list. */
export const ADMIN_DRAFT_COUNTS_KEY = 'admin-list-draft-counts'
