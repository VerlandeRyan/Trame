// Profil public : types de `GET /users/{handle}` et logique pure de la page (testée sans Nuxt).
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

/** Premières lettres du pseudo, pour le monogramme sans photo. */
export function monogram(handle: string): string {
  return handle.slice(0, 2).toUpperCase()
}

/** Ordre de la barre et de la légende (maquette 11) : en cours, à lire, terminées, en pause, abandonnées. */
export const PROFILE_STATUS_ORDER: LibraryStatus[] = [
  'reading',
  'plan_to_read',
  'completed',
  'on_hold',
  'dropped',
]

/** Part de chaque statut dans la barre (0 à 100), dans `PROFILE_STATUS_ORDER` ; vide sans œuvre. */
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

/** Progression d'une mise à jour : terminée (avec sa note), sinon le tome ou le chapitre atteint. */
export type UpdateProgress =
  { kind: 'completed'; rating: number | null } | { kind: 'volume' | 'chapter'; value: number }

export function updateProgress(entry: LibraryEntry): UpdateProgress {
  if (entry.status === 'completed') return { kind: 'completed', rating: entry.rating }
  return incrementUnit(entry) === 'volumes'
    ? { kind: 'volume', value: entry.volumesRead }
    : { kind: 'chapter', value: entry.chaptersRead }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Âge d'une mise à jour : « aujourd'hui », « hier », ou un nombre de jours / semaines / mois. */
export type UpdateAge =
  { unit: 'today' | 'yesterday' } | { unit: 'days' | 'weeks' | 'months'; count: number }

export function updateAge(updatedAt: string, now: Date = new Date()): UpdateAge {
  const days = Math.floor((startOfDay(now) - startOfDay(new Date(updatedAt))) / DAY_MS)
  if (days <= 0) return { unit: 'today' }
  if (days === 1) return { unit: 'yesterday' }
  if (days < 14) return { unit: 'days', count: days }
  if (days < 60) return { unit: 'weeks', count: Math.floor(days / 7) }
  return { unit: 'months', count: Math.floor(days / 30) }
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}
