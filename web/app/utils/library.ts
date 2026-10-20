// Liste de lecture : types de la réponse `GET /works/:id/entry` et logique pure (testée sans Nuxt).

export const LIBRARY_STATUSES = [
  'reading',
  'completed',
  'plan_to_read',
  'on_hold',
  'dropped',
] as const
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number]

/** Statut d'une œuvre qu'on vient d'ajouter à sa liste. */
export const DEFAULT_LIBRARY_STATUS: LibraryStatus = 'plan_to_read'

export interface LibraryEntry {
  status: LibraryStatus
  chaptersRead: number
  volumesRead: number
  rating: number | null
  startedOn: string | null
  finishedOn: string | null
}

/** Corps de `PUT /works/:id/entry` : le statut est toujours envoyé, le reste seulement s'il change. */
export type LibraryEntryChanges = Partial<LibraryEntry>

/** Note de 1 à 10 (la valeur 0 du compteur signifie « pas de note »). */
export const RATING_MAX = 10

/**
 * Question posée avant de changer le statut à cause d'une progression :
 * `start` (« À lire » → « En cours »), `resume` (« En pause » ou « Abandonné » → « En cours »),
 * `finishChapters` / `finishVolumes` (le total connu est atteint → « Terminé »).
 */
export type ReadingPrompt = 'start' | 'resume' | 'finishChapters' | 'finishVolumes'

/** Totaux parus connus (`null` : inconnu, jamais de proposition de fin). */
export interface KnownTotals {
  chapters: number | null
  volumes: number | null
}

const READING_PROMPTS: Partial<Record<LibraryStatus, ReadingPrompt>> = {
  plan_to_read: 'start',
  on_hold: 'resume',
  dropped: 'resume',
}

/** Le compteur franchit le total connu (le total connu veut dire que la publication est finie). */
function hasReachedTotal(before: number, after: number | undefined, total: number | null) {
  return total !== null && after !== undefined && before < total && after >= total
}

/**
 * Faut-il demander avant de changer le statut ? Atteindre le total connu de chapitres ou de tomes
 * propose « Terminé » (sauf si l'œuvre l'est déjà) ; sinon un chapitre ou un tome de plus sur une
 * œuvre « À lire », « En pause » ou « Abandonné » propose « En cours ». `null` : rien à demander,
 * y compris quand le changement fixe déjà un statut.
 */
export function readingPrompt(
  entry: LibraryEntry,
  changes: LibraryEntryChanges,
  totals: KnownTotals,
): ReadingPrompt | null {
  if (changes.status !== undefined) return null
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

/** Les changements accompagnés du statut proposé par la question, une fois confirmée. */
export function withPromptStatus(
  prompt: ReadingPrompt,
  changes: LibraryEntryChanges,
): LibraryEntryChanges {
  const isFinish = prompt === 'finishChapters' || prompt === 'finishVolumes'
  return { ...changes, status: isFinish ? 'completed' : 'reading' }
}

/** Avertissement non bloquant : on a lu plus que ce que le catalogue connaît (total inconnu : jamais). */
export function exceedsKnownTotal(value: number, total: number | null): boolean {
  return total !== null && value > total
}

const LIBRARY_ERROR_KEYS = new Map([
  ['UNAUTHENTICATED', 'library.error.signedOut'],
  ['HANDLE_REQUIRED', 'library.error.signedOut'],
  ['NOT_FOUND', 'library.error.notFound'],
  ['RATE_LIMITED', 'error.RATE_LIMITED'],
])

/** Clé de traduction du message à afficher pour un code d'erreur de l'API. */
export function libraryErrorKey(code: string): string {
  return LIBRARY_ERROR_KEYS.get(code) ?? 'library.error.generic'
}
