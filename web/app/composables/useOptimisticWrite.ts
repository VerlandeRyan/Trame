import type { ApiError } from '~/utils/api-error'
import { libraryErrorKey } from '~/utils/library'

interface OptimisticStep<Result> {
  /** Change l'affichage tout de suite, avant la réponse du serveur. */
  apply?: () => void
  /** La requête d'écriture, envoyée après celles déjà en route. */
  send: () => Promise<Result>
  /** Reçoit la réponse du serveur, seulement si aucune demande plus récente n'est en route. */
  reconcile?: (result: Result) => void
  /** Remet l'affichage d'avant ; sans lui, c'est `resync` qui le recale sur le serveur. */
  revert?: () => void
}

/**
 * Écriture à effet immédiat : le changement s'affiche aussitôt, les requêtes partent l'une après
 * l'autre et seule la dernière réponse remplace l'affichage. Un échec est annoncé par `errorKey`,
 * puis l'écran est remis d'aplomb (`revert` de l'étape, sinon `resync`).
 */
export function useOptimisticWrite(options: { resync?: () => Promise<void> } = {}) {
  const errorKey = ref<string | null>(null)

  const { enqueue, isBusy, isLatest } = useRequestQueue({
    onStart: () => {
      errorKey.value = null
    },
    // Les échecs sont traités dans `run`, où l'on connaît `revert`.
    onError: () => undefined,
  })

  async function recoverFrom(cause: unknown, revert: (() => void) | undefined) {
    errorKey.value = libraryErrorKey((cause as ApiError).code)
    if (revert) return revert()
    try {
      await options.resync?.()
    } catch {
      // Le message d'erreur est déjà affiché ; l'affichage reste tel qu'il est.
    }
  }

  function run<Result>(step: OptimisticStep<Result>): Promise<void> {
    step.apply?.()
    return enqueue(async () => {
      try {
        const result = await step.send()
        if (isLatest()) step.reconcile?.(result)
      } catch (cause) {
        await recoverFrom(cause, step.revert)
      }
    })
  }

  return { run, isBusy, errorKey }
}
