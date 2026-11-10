/** Public profile: response types and the pure logic of the page (tested without Nuxt). */
import type { LibraryEntry, LibraryStatus, StatusCounts } from '../contract/api'
import { incrementUnit } from './home'

export type {
  Profile,
  ProfileDetails,
  ProfileRatedWork,
  ProfileStats,
  ProfileUpdate,
  ProfileVisibility,
} from '../contract/api'

/** First letters of the handle, for the monogram shown without a photo. */
export function monogram(handle: string): string {
  return handle.slice(0, 2).toUpperCase()
}

/** Order of the bar and legend: reading, plan to read, completed, on hold, dropped. */
export const PROFILE_STATUS_ORDER: LibraryStatus[] = [
  'reading',
  'plan_to_read',
  'completed',
  'on_hold',
  'dropped',
]

/** Share of each status in the bar (0 to 100), in `PROFILE_STATUS_ORDER`; empty without works. */
export function statusShares(
  counts: StatusCounts,
): { status: LibraryStatus; count: number; percent: number }[] {
  const total = PROFILE_STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0)
  if (total === 0) return []
  return PROFILE_STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => ({
    status,
    count: counts[status],
    percent: (counts[status] / total) * 100,
  }))
}

/** Progress of an update: completed (with its rating), otherwise the volume or chapter reached. */
export type UpdateProgress =
  { kind: 'completed'; rating: number | null } | { kind: 'volume' | 'chapter'; value: number }

/** Progress shown for a recently updated entry. */
export function updateProgress(entry: LibraryEntry): UpdateProgress {
  if (entry.status === 'completed') return { kind: 'completed', rating: entry.rating }
  return incrementUnit(entry) === 'volumes'
    ? { kind: 'volume', value: entry.volumesRead }
    : { kind: 'chapter', value: entry.chaptersRead }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Age of an update: today, yesterday, or a number of days / weeks / months. */
export type UpdateAge =
  { unit: 'today' | 'yesterday' } | { unit: 'days' | 'weeks' | 'months'; count: number }

/** How long ago an update happened, counted in calendar days. */
export function updateAge(updatedAt: string, now: Date = new Date()): UpdateAge {
  const days = Math.floor((startOfDay(now) - startOfDay(new Date(updatedAt))) / DAY_MS)
  if (days <= 0) return { unit: 'today' }
  if (days === 1) return { unit: 'yesterday' }
  if (days < 14) return { unit: 'days', count: days }
  if (days < 60) return { unit: 'weeks', count: Math.floor(days / 7) }
  return { unit: 'months', count: Math.floor(days / 30) }
}

/** Timestamp of the local midnight that starts the date's day. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}
