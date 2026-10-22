// Ma liste de lecture : types de `GET /me/entries` et logique pure de la page (testée sans Nuxt).
import { LIBRARY_STATUSES, type LibraryEntry, type LibraryStatus } from './library'
import type { WorkSummary } from './search'

/** Œuvres demandées par page (limite de l'API). */
export const LIST_PAGE_SIZE = 50

/** Une œuvre de la liste, avec ses totaux parus (`null` : inconnu ou en cours de publication). */
export interface ListedWork extends WorkSummary {
  chapters: number | null
  volumes: number | null
}

export interface ListedEntry {
  work: ListedWork
  entry: LibraryEntry
}

export type StatusCounts = Record<LibraryStatus, number>

/** Chapitres et tomes lus sur toute la liste : deux totaux, jamais additionnés. */
export interface ReadingTotals {
  chaptersRead: number
  volumesRead: number
}

export interface ListPage {
  items: ListedEntry[]
  page: number
  pageSize: number
  total: number
  statusCounts: StatusCounts
  totals: ReadingTotals
}

export type ListSort = 'updated' | 'title' | 'rating'
export const LIST_SORTS: ListSort[] = ['updated', 'title', 'rating']
const DEFAULT_SORT: ListSort = 'updated'

export type ListView = 'list' | 'grid'
const DEFAULT_VIEW: ListView = 'list'

/** Ce que la grille compte sur chaque couverture. */
export type ListUnit = 'chapters' | 'volumes'

/** L'adresse de la page : un onglet de statut (`null` : tous), la recherche, le tri et la vue. */
export interface ListState {
  status: LibraryStatus | null
  q: string
  sort: ListSort
  view: ListView
}

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 100

function firstString(value: unknown): string {
  const single = Array.isArray(value) ? value[0] : value
  return typeof single === 'string' ? single : ''
}

/** Valeurs inconnues ignorées plutôt que de provoquer une 400. */
export function parseListQuery(query: Record<string, unknown>): ListState {
  const status = LIBRARY_STATUSES.find((candidate) => candidate === firstString(query.status))
  const sort = LIST_SORTS.find((candidate) => candidate === firstString(query.sort))
  return {
    status: status ?? null,
    q: firstString(query.q).replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH),
    sort: sort ?? DEFAULT_SORT,
    view: firstString(query.view) === 'grid' ? 'grid' : DEFAULT_VIEW,
  }
}

/** Une recherche d'un seul caractère n'est pas envoyée (l'API la refuserait). */
function hasSearchText(q: string): boolean {
  return q.length >= MIN_QUERY_LENGTH
}

/** Paramètres de l'adresse du site : les valeurs par défaut n'y figurent pas. */
export function toListRouteQuery(state: ListState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.status !== null) query.status = state.status
  if (state.q !== '') query.q = state.q
  if (state.sort !== DEFAULT_SORT) query.sort = state.sort
  if (state.view !== DEFAULT_VIEW) query.view = state.view
  return query
}

export function toListApiQuery(
  state: ListState,
  options: { lang: string; page: number },
): Record<string, string | number> {
  const query: Record<string, string | number> = {
    lang: options.lang,
    sort: state.sort,
    page: options.page,
    pageSize: LIST_PAGE_SIZE,
  }
  if (state.status !== null) query.status = state.status
  if (hasSearchText(state.q)) query.q = state.q
  return query
}

/** Nombre d'œuvres de l'onglet « Tous ». */
export function countEntriesOfAllStatuses(counts: StatusCounts): number {
  return LIBRARY_STATUSES.reduce((sum, status) => sum + counts[status], 0)
}

/** Reste-t-il des œuvres à charger ? */
export function hasMorePages(loaded: number, total: number): boolean {
  return loaded < total
}

/** L'entrée appartient-elle encore à l'onglet affiché ? */
export function isInTab(entry: LibraryEntry, status: LibraryStatus | null): boolean {
  return status === null || entry.status === status
}

/**
 * Compteurs et totaux après un changement local, sans relire la liste : `after` est `null` quand
 * l'œuvre est retirée.
 */
export function applyEntryChangeToCounts(
  summary: { statusCounts: StatusCounts; totals: ReadingTotals },
  before: LibraryEntry,
  after: LibraryEntry | null,
): { statusCounts: StatusCounts; totals: ReadingTotals } {
  const statusCounts = { ...summary.statusCounts }
  statusCounts[before.status] -= 1
  if (after) statusCounts[after.status] += 1
  return {
    statusCounts,
    totals: {
      chaptersRead: summary.totals.chaptersRead + (after?.chaptersRead ?? 0) - before.chaptersRead,
      volumesRead: summary.totals.volumesRead + (after?.volumesRead ?? 0) - before.volumesRead,
    },
  }
}

/** Lu et total paru d'une œuvre pour le compteur choisi (`total` `null` : inconnu). */
export function unitProgress(
  item: ListedEntry,
  unit: ListUnit,
): { read: number; total: number | null } {
  return unit === 'chapters'
    ? { read: item.entry.chaptersRead, total: item.work.chapters }
    : { read: item.entry.volumesRead, total: item.work.volumes }
}

/** « 12 » tant que le total est inconnu, « 86/86 » sinon. */
export function formatProgress(progress: { read: number; total: number | null }): string {
  return progress.total === null ? String(progress.read) : `${progress.read}/${progress.total}`
}

/** Le doigt entraîne la couverture à ce rapport, dans la limite de `MAX_DRAG_OFFSET` (px). */
const DRAG_RATIO = 0.8
const MAX_DRAG_OFFSET = 84
/** Mouvement minimal avant que la couverture suive le doigt (sinon un toucher la ferait trembler). */
const DRAG_DEAD_ZONE = 8
/** Déplacement du doigt (px) qui valide −1 / +1, comme `swipeDirection`. */
const SWIPE_COMMIT_DISTANCE = 40

/**
 * Décalage horizontal de la couverture pendant qu'on la glisse : amorti et borné, 0 pour un geste
 * court ou plutôt vertical (défilement de la page).
 */
export function dragOffset(deltaX: number, deltaY: number): number {
  if (Math.abs(deltaX) < DRAG_DEAD_ZONE || Math.abs(deltaX) < 1.5 * Math.abs(deltaY)) return 0
  return Math.max(-MAX_DRAG_OFFSET, Math.min(MAX_DRAG_OFFSET, deltaX * DRAG_RATIO))
}

/** De 0 à 1 : à 1 le geste est assez long pour être validé au relâchement. */
export function dragProgress(offset: number): number {
  return Math.min(1, Math.abs(offset) / (SWIPE_COMMIT_DISTANCE * DRAG_RATIO))
}
