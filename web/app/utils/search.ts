// Recherche : types des réponses de l'API et logique pure de la page de résultats.
import type { WorkStatus, WorkType } from './work'

export const MIN_QUERY_LENGTH = 2
export const PAGE_SIZE = 20
export const SUGGESTION_COUNT = 3

export interface WorkSummary {
  id: number
  title: string
  originalTitle: string
  originalLanguage: string
  type: WorkType
  status: WorkStatus
  formats: string[]
  coverPath: string | null
  mainAuthor: string | null
}

export interface WorkPage {
  items: WorkSummary[]
  page: number
  pageSize: number
  total: number
  /** Aucune œuvre ne contient tous les mots : la liste donne celles qui en ont au moins un. */
  approximate: boolean
}

export interface FacetCount {
  code: string
  count: number
}

export type FilterKey = 'type' | 'format' | 'genre' | 'status' | 'originalLanguage'

export type WorkFacets = Record<FilterKey, FacetCount[]>

export const FILTER_KEYS: FilterKey[] = ['type', 'format', 'genre', 'status', 'originalLanguage']

/** Plusieurs valeurs par groupe (OU, sauf les genres en ET) ; les groupes se combinent (ET). */
export type SearchFilters = Partial<Record<FilterKey, string[]>>

export const MAX_FILTER_VALUES = 10

export type SearchSort = 'relevance' | 'title' | 'recent'
export const SORTS: SearchSort[] = ['relevance', 'title', 'recent']

/** Tri par défaut de l'API. */
const API_DEFAULT_SORT: SearchSort = 'relevance'

export function hasSearchText(q: string): boolean {
  return q.length >= MIN_QUERY_LENGTH
}

/** Avec du texte : pertinence ; sans : le catalogue, du plus récemment ajouté. */
export function defaultSort(q: string): SearchSort {
  return hasSearchText(q) ? 'relevance' : 'recent'
}

export interface SearchState {
  q: string
  page: number
  sort: SearchSort
  filters: SearchFilters
}

const WORK_TYPES = new Set(['series', 'oneshot', 'anthology'])
const WORK_STATUSES = new Set(['upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned'])
const GENRE_CODE = /^[a-z0-9]+(_[a-z0-9]+)*$/
const LANGUAGE_CODE = /^[a-z]{2,3}$/

/** Valeurs acceptées par l'API ; le reste est ignoré plutôt que de provoquer une 400. */
const FILTER_VALIDATORS: Record<FilterKey, (value: string) => boolean> = {
  type: (value) => WORK_TYPES.has(value),
  status: (value) => WORK_STATUSES.has(value),
  format: (value) => value.length <= 50 && GENRE_CODE.test(value),
  genre: (value) => value.length <= 50 && GENRE_CODE.test(value),
  originalLanguage: (value) => LANGUAGE_CODE.test(value),
}

function firstString(value: unknown): string {
  const single = Array.isArray(value) ? value[0] : value
  return typeof single === 'string' ? single : ''
}

/** Espaces réduits, 100 caractères au plus (limite de l'API). */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 100)
}

export function parseSearchQuery(query: Record<string, unknown>): SearchState {
  const filters: SearchFilters = {}
  for (const key of FILTER_KEYS) {
    // `status=ongoing,hiatus` : valeurs invalides et doublons ignorés.
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
  // Pas de pertinence sans texte de recherche.
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

/** Texte envoyé à l'API : vide s'il fait moins de `MIN_QUERY_LENGTH` caractères. */
export function activeQuery(state: SearchState): string {
  return hasSearchText(state.q) ? state.q : ''
}

/** Query string de l'URL : seulement ce qui s'écarte des défauts. */
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

/** Paramètres de la liste (`page: true`) ou des compteurs (sans langue, page ni tri). */
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
    // Pertinence par défaut côté API : le tri n'est envoyé que s'il en diffère.
    if (state.sort !== API_DEFAULT_SORT) query.sort = state.sort
  }
  return query
}

export function activeFilters(state: SearchState): { key: FilterKey; code: string }[] {
  return FILTER_KEYS.flatMap((key) => (state.filters[key] ?? []).map((code) => ({ key, code })))
}

/** Ajoute la valeur au groupe, ou la retire si elle y était (10 au plus, groupe vide supprimé). */
export function toggleFilter(state: SearchState, key: FilterKey, code: string): SearchState {
  const { [key]: current = [], ...others } = state.filters
  let values = current.includes(code)
    ? current.filter((value) => value !== code)
    : [...current, code]
  if (values.length > MAX_FILTER_VALUES) values = current
  const filters: SearchFilters = values.length > 0 ? { ...others, [key]: values } : others
  return { ...state, filters, page: 1 }
}

export function resetFilters(state: SearchState): SearchState {
  return { ...state, filters: {}, page: 1 }
}

export function changeSort(state: SearchState, sort: SearchSort): SearchState {
  return { ...state, sort, page: 1 }
}

/** Valeurs de l'API plus les valeurs choisies, même à zéro (pour pouvoir les retirer). */
export function filterOptions(facets: FacetCount[], selected: string[]): FacetCount[] {
  const missing = selected.filter((code) => !facets.some((facet) => facet.code === code))
  return missing.length === 0 ? facets : [...facets, ...missing.map((code) => ({ code, count: 0 }))]
}

type Translate = (key: string) => string
type HasTranslation = (key: string) => boolean

/** Traduction du code si elle existe, sinon le code tel quel. */
export function translatedCode(
  translate: Translate,
  hasTranslation: HasTranslation,
  prefix: string,
  code: string,
): string {
  const key = `${prefix}.${code}`
  return hasTranslation(key) ? translate(key) : code
}

const FILTER_VALUE_PREFIX: Record<FilterKey, string> = {
  type: 'workType',
  status: 'workStatus',
  format: 'genre',
  genre: 'genre',
  originalLanguage: 'language',
}

/** Libellé d'une valeur de filtre ; une langue sans traduction s'affiche en majuscules. */
export function filterValueLabel(
  translate: Translate,
  hasTranslation: HasTranslation,
  key: FilterKey,
  code: string,
): string {
  const label = translatedCode(translate, hasTranslation, FILTER_VALUE_PREFIX[key], code)
  return key === 'originalLanguage' && label === code ? code.toUpperCase() : label
}

export type PageItem = number | 'gap'

/** Première, dernière et voisinage de la page courante, avec des « … » entre. */
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

export function totalPages(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Langue d'origine (« FR : Aube Fictive ») quand elle diffère de celle de l'interface. */
export interface OriginalLine {
  language: string
  title: string
}

export function originalLine(
  work: Pick<WorkSummary, 'originalTitle' | 'originalLanguage'>,
  uiLanguage: string,
): OriginalLine | null {
  if (work.originalLanguage === uiLanguage) return null
  return { language: work.originalLanguage, title: work.originalTitle }
}
