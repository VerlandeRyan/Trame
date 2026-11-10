/** My reading list: response types and pure logic of the page (tested without Nuxt). */
import type {
  LibraryEntry,
  LibraryStatus,
  ListedEntry,
  ReadingTotals,
  StatusCounts,
} from '../contract/api'
import { LIBRARY_STATUSES } from './library'

export type {
  ListedEntry,
  ListedWork,
  ListPage,
  ReadingTotals,
  StatusCounts,
} from '../contract/api'

/** Works requested per page (the API limit). */
export const LIST_PAGE_SIZE = 50

/** Sort orders of the list: latest progress, title, best rated. */
export type ListSort = 'updated' | 'title' | 'rating'
export const LIST_SORTS: ListSort[] = ['updated', 'title', 'rating']
const DEFAULT_SORT: ListSort = 'updated'

/** Display modes of the list. */
export type ListView = 'list' | 'grid'
const DEFAULT_VIEW: ListView = 'list'

/** What the grid counts on each cover. */
export type ListUnit = 'chapters' | 'volumes'

/** The page address state: a status tab (`null`: all), the search, the sort and the view. */
export interface ListState {
  status: LibraryStatus | null
  q: string
  sort: ListSort
  view: ListView
}

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 100

/** First string of a query value (which may be repeated), empty when there is none. */
function firstString(value: unknown): string {
  const single = Array.isArray(value) ? value[0] : value
  return typeof single === 'string' ? single : ''
}

/** Reads the list state from the address; unknown values are ignored rather than causing a 400. */
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

/** A one-character search is not sent (the API would reject it). */
function hasSearchText(q: string): boolean {
  return q.length >= MIN_QUERY_LENGTH
}

/** Query parameters of the site address: default values are left out. */
export function toListRouteQuery(state: ListState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.status !== null) query.status = state.status
  if (state.q !== '') query.q = state.q
  if (state.sort !== DEFAULT_SORT) query.sort = state.sort
  if (state.view !== DEFAULT_VIEW) query.view = state.view
  return query
}

/** Query parameters of the API call for one page of the list. */
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

/** Number of works of the "All" tab. */
export function countEntriesOfAllStatuses(counts: StatusCounts): number {
  return LIBRARY_STATUSES.reduce((sum, status) => sum + counts[status], 0)
}

/** Whether more works remain to be loaded. */
export function hasMorePages(loaded: number, total: number): boolean {
  return loaded < total
}

/** Whether the entry still belongs to the displayed tab. */
export function isInTab(entry: LibraryEntry, status: LibraryStatus | null): boolean {
  return status === null || entry.status === status
}

/**
 * Counts and totals after a local change, without reloading the list: `after` is `null` when
 * the work is removed.
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

/** Amount read and published total of a work for the chosen counter (`total` `null`: unknown). */
export function unitProgress(
  item: ListedEntry,
  unit: ListUnit,
): { read: number; total: number | null } {
  return unit === 'chapters'
    ? { read: item.entry.chaptersRead, total: item.work.chapters }
    : { read: item.entry.volumesRead, total: item.work.volumes }
}

/** "12" while the total is unknown, "86/86" otherwise. */
export function formatProgress(progress: { read: number; total: number | null }): string {
  return progress.total === null ? String(progress.read) : `${progress.read}/${progress.total}`
}

/** The finger drags the cover at this ratio, up to `MAX_DRAG_OFFSET` (px). */
const DRAG_RATIO = 0.8
const MAX_DRAG_OFFSET = 84
/** Minimum movement before the cover follows the finger (otherwise a tap would make it tremble). */
const DRAG_DEAD_ZONE = 8
/** Finger travel (px) that commits −1 / +1, like `swipeDirection`. */
const SWIPE_COMMIT_DISTANCE = 40

/**
 * Horizontal offset of the cover while it is dragged: damped and capped, 0 for a short or mostly
 * vertical gesture (page scroll).
 */
export function dragOffset(deltaX: number, deltaY: number): number {
  if (Math.abs(deltaX) < DRAG_DEAD_ZONE || Math.abs(deltaX) < 1.5 * Math.abs(deltaY)) return 0
  return Math.max(-MAX_DRAG_OFFSET, Math.min(MAX_DRAG_OFFSET, deltaX * DRAG_RATIO))
}

/** From 0 to 1: at 1 the gesture is long enough to be committed on release. */
export function dragProgress(offset: number): number {
  return Math.min(1, Math.abs(offset) / (SWIPE_COMMIT_DISTANCE * DRAG_RATIO))
}
