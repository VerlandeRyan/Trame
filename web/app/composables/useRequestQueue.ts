/**
 * File de requêtes d'écriture : elles partent l'une après l'autre (des « +1 » enchaînés ne se
 * croisent jamais). `isLatest` dit si la requête en cours est la dernière demandée : seule sa
 * réponse, celle du serveur, doit remplacer l'état affiché.
 */
export function useRequestQueue(handlers: {
  /** Avant chaque requête (par exemple effacer l'erreur précédente). */
  onStart: () => void
  /** Une requête a échoué : l'écran a pu s'écarter du serveur. */
  onError: (cause: unknown) => Promise<void> | void
}) {
  const isBusy = ref(false)
  let pendingCount = 0
  let queue: Promise<void> = Promise.resolve()

  function enqueue(task: () => Promise<void>): Promise<void> {
    pendingCount += 1
    isBusy.value = true
    queue = queue
      .then(() => {
        handlers.onStart()
        return task()
      })
      .catch(handlers.onError)
      .finally(() => {
        pendingCount -= 1
        isBusy.value = pendingCount > 0
      })
    return queue
  }

  const isLatest = () => pendingCount === 1

  return { enqueue, isBusy, isLatest }
}
