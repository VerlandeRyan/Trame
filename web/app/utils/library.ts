/** Reading list: entry response types and pure logic (tested without Nuxt). */
import type { LibraryEntry, LibraryStatus } from '../contract/api'

export type { LibraryEntry, LibraryStatus } from '../contract/api'

/** Runtime values of the status (menus, tabs), generated with the contract. */
export { LIBRARY_STATUSES } from '../contract/api'

/** Status of a work that has just been added to the list. */
export const DEFAULT_LIBRARY_STATUS: LibraryStatus = 'plan_to_read'

/** Body of an entry update: the status is always sent, the rest only when it changes. */
export type LibraryEntryChanges = Partial<LibraryEntry>

/** Rating from 1 to 10 (a counter value of 0 means "no rating"). */
export const RATING_MAX = 10

/**
 * Question asked before changing the status because of progress:
 * `start` (plan to read → reading), `resume` (on hold or dropped → reading),
 * `finishChapters` / `finishVolumes` (the known total is reached → completed),
 * `completeCounters` (switching to completed with counters below the known total → set them to it).
 */
export type ReadingPrompt =
  'start' | 'resume' | 'finishChapters' | 'finishVolumes' | 'completeCounters'

/** Known published totals (`null`: unknown, never a proposal to finish). */
export interface KnownTotals {
  chapters: number | null
  volumes: number | null
}

/** Prompt triggered by progress, according to the current status. */
const READING_PROMPTS: Partial<Record<LibraryStatus, ReadingPrompt>> = {
  plan_to_read: 'start',
  on_hold: 'resume',
  dropped: 'resume',
}

/** The counter crosses the known total (a known total means the publication is finished). */
function hasReachedTotal(before: number, after: number | undefined, total: number | null) {
  return total !== null && after !== undefined && before < total && after >= total
}

/**
 * Counters to raise to the known published total when the work becomes completed: only those
 * still below it (a counter entered in the same changes already counts).
 */
export function countersToTotals(
  entry: LibraryEntry,
  changes: LibraryEntryChanges,
  totals: KnownTotals,
): Pick<LibraryEntryChanges, 'chaptersRead' | 'volumesRead'> {
  const missing: Pick<LibraryEntryChanges, 'chaptersRead' | 'volumesRead'> = {}
  const chapters = changes.chaptersRead ?? entry.chaptersRead
  const volumes = changes.volumesRead ?? entry.volumesRead
  if (totals.chapters !== null && chapters < totals.chapters) missing.chaptersRead = totals.chapters
  if (totals.volumes !== null && volumes < totals.volumes) missing.volumesRead = totals.volumes
  return missing
}

/**
 * Whether to ask before changing the status. Switching to completed with counters below the known
 * published total offers to set them to it. Reaching the known chapter or volume total offers
 * completed (unless the work already is); otherwise one more chapter or volume on a plan-to-read,
 * on-hold or dropped work offers reading. `null`: nothing to ask, including when the change
 * already sets another status.
 */
export function readingPrompt(
  entry: LibraryEntry,
  changes: LibraryEntryChanges,
  totals: KnownTotals,
): ReadingPrompt | null {
  if (changes.status !== undefined) {
    const isCompleting = changes.status === 'completed' && entry.status !== 'completed'
    const hasGap = Object.keys(countersToTotals(entry, changes, totals)).length > 0
    return isCompleting && hasGap ? 'completeCounters' : null
  }
  if (entry.status !== 'completed') {
    if (hasReachedTotal(entry.chaptersRead, changes.chaptersRead, totals.chapters)) {
      return 'finishChapters'
    }
    if (hasReachedTotal(entry.volumesRead, changes.volumesRead, totals.volumes)) {
      return 'finishVolumes'
    }
  }
  const hasAdvanced =
    (changes.chaptersRead ?? entry.chaptersRead) > entry.chaptersRead ||
    (changes.volumesRead ?? entry.volumesRead) > entry.volumesRead
  return hasAdvanced ? (READING_PROMPTS[entry.status] ?? null) : null
}

/** The changes once the question is confirmed: the proposed status (and, for `completeCounters`, counters at the totals). */
export function withPromptStatus(
  prompt: ReadingPrompt,
  changes: LibraryEntryChanges,
  entry: LibraryEntry,
  totals: KnownTotals,
): LibraryEntryChanges {
  if (prompt === 'completeCounters')
    return { ...changes, ...countersToTotals(entry, changes, totals) }
  const isFinish = prompt === 'finishChapters' || prompt === 'finishVolumes'
  return { ...changes, status: isFinish ? 'completed' : 'reading' }
}

/** On these questions, declining still saves the requested change (counter or status alone). */
export function keepsChangesOnDecline(prompt: ReadingPrompt): boolean {
  return prompt === 'finishChapters' || prompt === 'finishVolumes' || prompt === 'completeCounters'
}

/** Non-blocking warning: more was read than the catalogue knows (unknown total: never). */
export function exceedsKnownTotal(value: number, total: number | null): boolean {
  return total !== null && value > total
}

/** Translation key of the message shown for each handled API error code. */
const LIBRARY_ERROR_KEYS = new Map([
  ['UNAUTHENTICATED', 'library.error.signedOut'],
  ['HANDLE_REQUIRED', 'library.error.signedOut'],
  ['NOT_FOUND', 'library.error.notFound'],
  ['RATE_LIMITED', 'error.RATE_LIMITED'],
])

/** Translation key of the message to display for an API error code. */
export function libraryErrorKey(code: string): string {
  return LIBRARY_ERROR_KEYS.get(code) ?? 'library.error.generic'
}
