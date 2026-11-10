/** Search: API response types and pure logic of the results page. */
import { WORK_STATUSES, WORK_TYPES, type FacetCount, type WorkSummary } from '../contract/api'

export type { FacetCount, WorkFacets, WorkPage, WorkSummary } from '../contract/api'

/** Shortest search text sent to the API. */
export const MIN_QUERY_LENGTH = 2
/** Results per page. */
export const PAGE_SIZE = 20
/** Number of suggestions offered while typing. */
export const SUGGESTION_COUNT = 3

/** Filter groups of the search. */
export type FilterKey = 'type' | 'format' | 'genre' | 'status' | 'originalLanguage'

export const FILTER_KEYS: FilterKey[] = ['type', 'format', 'genre', 'status', 'originalLanguage']

/** Several values per group (OR, except genres which are AND); groups combine together (AND). */
export type SearchFilters = Partial<Record<FilterKey, string[]>>

/** Maximum number of values in one filter group. */
export const MAX_FILTER_VALUES = 10

/** Sort orders of the results. */
export type SearchSort = 'relevance' | 'title' | 'recent'
export const SORTS: SearchSort[] = ['relevance', 'title', 'recent']

/** The API's default sort. */
const API_DEFAULT_SORT: SearchSort = 'relevance'

/** Whether the text is long enough to be sent as a search. */
export function hasSearchText(q: string): boolean {
  return q.length >= MIN_QUERY_LENGTH
}

/** With text: relevance; without: the catalogue, most recently added first. */
export function defaultSort(q: string): SearchSort {
  return hasSearchText(q) ? 'relevance' : 'recent'
}

/** The search page state kept in the address: text, page, sort and filters. */
export interface SearchState {
  q: string
  page: number
  sort: SearchSort
  filters: SearchFilters
}

const WORK_TYPE_CODES = new Set<string>(WORK_TYPES)
const WORK_STATUS_CODES = new Set<string>(WORK_STATUSES)
const GENRE_CODE = /^[a-z0-9]+(_[a-z0-9]+)*$/
const LANGUAGE_CODE = /^[a-z]{2,3}$/

/** Values the API accepts; anything else is ignored rather than causing a 400. */
const FILTER_VALIDATORS: Record<FilterKey, (value: string) => boolean> = {
  type: (value) => WORK_TYPE_CODES.has(value),
  status: (value) => WORK_STATUS_CODES.has(value),
  format: (value) => value.length <= 50 && GENRE_CODE.test(value),
  genre: (value) => value.length <= 50 && GENRE_CODE.test(value),
  originalLanguage: (value) => LANGUAGE_CODE.test(value),
}

/** First string of a query value (which may be repeated), empty when there is none. */
function firstString(value: unknown): string {
  const single = Array.isArray(value) ? value[0] : value
  return typeof single === 'string' ? single : ''
}

/** Collapses whitespace and keeps at most 100 characters (the API limit). */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 100)
}

/** Reads the search state from the address; invalid values are ignored. */
export function parseSearchQuery(query: Record<string, unknown>): SearchState {
  const filters: SearchFilters = {}
  for (const key of FILTER_KEYS) {
    // `status=ongoing,hiatus`: invalid values and duplicates are ignored.
    const values = [
      ...new Set(
        firstString(query[key])
          .split(',')
          .map((part) => part.trim()),
      ),
    ]
      .filter((value) => value !== '' && FILTER_VALIDATORS[key](value))
      .slice(0, MAX_FILTER_VALUES)
    if (values.length > 0) filters[key] = values
  }
  const page = Number.parseInt(firstString(query.page), 10)
  const q = normalizeQuery(firstString(query.q))
  const requested = SORTS.find((candidate) => candidate === firstString(query.sort))
  // No relevance sort without search text.
  const sort =
    requested === undefined || (requested === 'relevance' && !hasSearchText(q))
      ? defaultSort(q)
      : requested
  return {
    q,
    page: Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1,
    sort,
    filters,
  }
}

/** Text sent to the API: empty if shorter than `MIN_QUERY_LENGTH` characters. */
export function activeQuery(state: SearchState): string {
  return hasSearchText(state.q) ? state.q : ''
}

/** Query string of the address: only what differs from the defaults. */
export function toRouteQuery(state: SearchState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.q !== '') query.q = state.q
  for (const key of FILTER_KEYS) {
    const values = state.filters[key]
    if (values !== undefined && values.length > 0) query[key] = values.join(',')
  }
  if (state.sort !== defaultSort(state.q)) query.sort = state.sort
  if (state.page > 1) query.page = String(state.page)
  return query
}

/** Parameters of the list (`page: true`) or of the facet counts (without language, page or sort). */
export function toApiQuery(
  state: SearchState,
  options: { lang: string; page?: boolean; pageSize?: number },
): Record<string, string | number> {
  const text = activeQuery(state)
  const query: Record<string, string | number> = {
    ...toRouteQuery({ ...state, q: text, page: 1, sort: defaultSort(text) }),
  }
  if (options.page) {
    query.lang = options.lang
    query.page = state.page
    query.pageSize = options.pageSize ?? PAGE_SIZE
    // Relevance is the API default: the sort is only sent when it differs.
    if (state.sort !== API_DEFAULT_SORT) query.sort = state.sort
  }
  return query
}

/** Every selected filter value as a (group, code) pair. */
export function activeFilters(state: SearchState): { key: FilterKey; code: string }[] {
  return FILTER_KEYS.flatMap((key) => (state.filters[key] ?? []).map((code) => ({ key, code })))
}

/** Adds the value to the group, or removes it if it was there (10 at most, empty group dropped). */
export function toggleFilter(state: SearchState, key: FilterKey, code: string): SearchState {
  const { [key]: current = [], ...others } = state.filters
  let values = current.includes(code)
    ? current.filter((value) => value !== code)
    : [...current, code]
  if (values.length > MAX_FILTER_VALUES) values = current
  const filters: SearchFilters = values.length > 0 ? { ...others, [key]: values } : others
  return { ...state, filters, page: 1 }
}

/** Clears every filter and goes back to the first page. */
export function resetFilters(state: SearchState): SearchState {
  return { ...state, filters: {}, page: 1 }
}

/** Changes the sort and goes back to the first page. */
export function changeSort(state: SearchState, sort: SearchSort): SearchState {
  return { ...state, sort, page: 1 }
}

/** The API's values plus the selected ones, even at zero (so they can be removed). */
export function filterOptions(facets: FacetCount[], selected: string[]): FacetCount[] {
  const missing = selected.filter((code) => !facets.some((facet) => facet.code === code))
  return missing.length === 0 ? facets : [...facets, ...missing.map((code) => ({ code, count: 0 }))]
}

type Translate = (key: string) => string
type HasTranslation = (key: string) => boolean

/** The code's translation if it exists, otherwise the code itself. */
export function translatedCode(
  translate: Translate,
  hasTranslation: HasTranslation,
  prefix: string,
  code: string,
): string {
  const key = `${prefix}.${code}`
  return hasTranslation(key) ? translate(key) : code
}

/** Translation key prefix of the values of each filter group. */
const FILTER_VALUE_PREFIX: Record<FilterKey, string> = {
  type: 'workType',
  status: 'workStatus',
  format: 'genre',
  genre: 'genre',
  originalLanguage: 'language',
}

/** Label of a filter value; a language without a translation is shown in capitals. */
export function filterValueLabel(
  translate: Translate,
  hasTranslation: HasTranslation,
  key: FilterKey,
  code: string,
): string {
  const label = translatedCode(translate, hasTranslation, FILTER_VALUE_PREFIX[key], code)
  return key === 'originalLanguage' && label === code ? code.toUpperCase() : label
}

/** An entry of the pagination bar: a page number or a gap ("…"). */
export type PageItem = number | 'gap'

/** First, last and neighbours of the current page, with gaps between. */
export function pageItems(current: number, totalPages: number): PageItem[] {
  const wanted = new Set([1, totalPages, current - 1, current, current + 1])
  const pages = [...wanted].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)
  const items: PageItem[] = []
  for (const page of pages) {
    const previous = items.at(-1)
    if (typeof previous === 'number' && page - previous > 1) items.push('gap')
    items.push(page)
  }
  return items
}

/** Number of pages for a total, at least one. */
export function totalPages(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Original language line ("FR : Some Title") shown when it differs from the interface language. */
export interface OriginalLine {
  language: string
  title: string
}

/** The original-title line of a work, or `null` when it is already in the interface language. */
export function originalLine(
  work: Pick<WorkSummary, 'originalTitle' | 'originalLanguage'>,
  uiLanguage: string,
): OriginalLine | null {
  if (work.originalLanguage === uiLanguage) return null
  return { language: work.originalLanguage, title: work.originalTitle }
}
