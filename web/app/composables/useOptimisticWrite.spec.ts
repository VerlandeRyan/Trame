import { describe, expect, it } from 'vitest'

function failure(code: string) {
  return Object.assign(new Error(code), { code })
}

describe('useOptimisticWrite', () => {
  it('affiche le changement avant d’envoyer la requête', async () => {
    const write = useOptimisticWrite()
    const steps: string[] = []

    const done = write.run({
      apply: () => steps.push('apply'),
      send: () => {
        steps.push('send')
        return Promise.resolve('saved')
      },
      reconcile: (result) => steps.push(`reconcile:${result}`),
    })
    expect(steps).toEqual(['apply'])
    await done

    expect(steps).toEqual(['apply', 'send', 'reconcile:saved'])
    expect(write.isBusy.value).toBe(false)
  })

  it('envoie dans l’ordre et ne réconcilie que la dernière réponse', async () => {
    const write = useOptimisticWrite()
    const sent: number[] = []
    const reconciled: number[] = []
    const request = (value: number, delayMs: number) =>
      write.run({
        send: async () => {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          sent.push(value)
          return value
        },
        reconcile: (result) => reconciled.push(result),
      })

    await Promise.all([request(1, 30), request(2, 0)])

    expect(sent).toEqual([1, 2])
    expect(reconciled).toEqual([2])
  })

  it('annonce l’échec puis resynchronise quand rien n’est à annuler', async () => {
    let resyncs = 0
    const write = useOptimisticWrite({
      resync: () => {
        resyncs += 1
        return Promise.resolve()
      },
    })

    await write.run({ send: () => Promise.reject(failure('INTERNAL_ERROR')), reconcile: () => {} })

    expect(write.errorKey.value).toBe('library.error.generic')
    expect(resyncs).toBe(1)
  })

  it('annule le changement affiché au lieu de resynchroniser quand `revert` est fourni', async () => {
    let resyncs = 0
    let reverts = 0
    const write = useOptimisticWrite({
      resync: () => {
        resyncs += 1
        return Promise.resolve()
      },
    })

    await write.run({
      send: () => Promise.reject(failure('UNAUTHENTICATED')),
      revert: () => {
        reverts += 1
      },
    })

    expect(write.errorKey.value).toBe('library.error.signedOut')
    expect(reverts).toBe(1)
    expect(resyncs).toBe(0)
  })

  it('reste utilisable si la resynchronisation échoue elle aussi', async () => {
    const write = useOptimisticWrite({ resync: () => Promise.reject(new Error('offline')) })

    await write.run({ send: () => Promise.reject(failure('INTERNAL_ERROR')) })

    expect(write.errorKey.value).toBe('library.error.generic')
    expect(write.isBusy.value).toBe(false)
  })

  it('efface l’erreur précédente au départ de la requête suivante', async () => {
    const write = useOptimisticWrite()
    await write.run({ send: () => Promise.reject(failure('INTERNAL_ERROR')) })
    expect(write.errorKey.value).not.toBeNull()

    await write.run({ send: () => Promise.resolve() })

    expect(write.errorKey.value).toBeNull()
  })
})
