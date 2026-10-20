import type { ApiError } from '~/utils/api-error'
import {
  DEFAULT_LIBRARY_STATUS,
  libraryErrorKey,
  type LibraryEntry,
  type LibraryEntryChanges,
} from '~/utils/library'

/**
 * Mon suivi d'une œuvre : lecture, ajout ou mise à jour (`PUT`) et retrait.
 * La lecture peut se faire au rendu serveur (cookie du visiteur transmis) : l'entrée et l'état
 * « chargé » passent par `useState`, la page arrive donc dans le bon état, sans clignotement.
 * Un changement s'affiche aussitôt ; les requêtes partent l'une après l'autre (des « +1 » enchaînés
 * ne se croisent jamais) et seule la dernière réponse, celle du serveur, remplace l'entrée.
 */
export function useLibraryEntry(workId: number) {
  const api = useApi()
  const entry = useState<LibraryEntry | null>(`library-entry-${workId}`, () => null)
  const isLoaded = useState(`library-loaded-${workId}`, () => false)
  const isBusy = ref(false)
  const errorKey = ref<string | null>(null)
  const path = `/works/${workId}/entry`
  const cookieHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  let pendingCount = 0
  let queue: Promise<void> = Promise.resolve()

  async function fetchEntry() {
    entry.value = (
      await api.request<{ entry: LibraryEntry | null }>(path, { headers: cookieHeaders })
    ).entry
  }

  /** Après un échec, l'écran a pu s'écarter du serveur : on le relit. */
  async function resyncAfter(cause: unknown) {
    errorKey.value = libraryErrorKey((cause as ApiError).code)
    try {
      await fetchEntry()
    } catch {
      // Le message d'erreur est déjà affiché ; l'entrée reste telle qu'elle est.
    }
  }

  function enqueue(task: () => Promise<void>): Promise<void> {
    pendingCount += 1
    isBusy.value = true
    queue = queue
      .then(() => {
        errorKey.value = null
        return task()
      })
      .catch(resyncAfter)
      .finally(() => {
        pendingCount -= 1
        isBusy.value = pendingCount > 0
      })
    return queue
  }

  async function load() {
    let hasFailed = false
    try {
      await fetchEntry()
    } catch (cause) {
      hasFailed = true
      errorKey.value = libraryErrorKey((cause as ApiError).code)
    }
    // Un échec au rendu serveur laisse « non chargé » : le navigateur réessaiera.
    if (!(import.meta.server && hasFailed)) isLoaded.value = true
  }

  /** Ajoute l'œuvre (statut « À lire ») ou applique `changes` à l'entrée existante. */
  function save(changes: LibraryEntryChanges) {
    if (entry.value) entry.value = { ...entry.value, ...changes }
    return enqueue(async () => {
      const body = { status: entry.value?.status ?? DEFAULT_LIBRARY_STATUS, ...changes }
      const saved = (await api.request<{ entry: LibraryEntry }>(path, { method: 'PUT', body }))
        .entry
      // Une demande plus récente est en route : sa réponse fera foi.
      if (pendingCount === 1) entry.value = saved
    })
  }

  function remove() {
    return enqueue(async () => {
      await api.request(path, { method: 'DELETE' })
      if (pendingCount === 1) entry.value = null
    })
  }

  return { entry, isLoaded, isBusy, errorKey, load, save, remove }
}
