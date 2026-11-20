import { beforeEach, describe, expect, it, vi } from 'vitest'

function failure(code: string) {
  return Object.assign(new Error(code), { status: 500, code })
}

describe('useOptimisticWrite', () => {
  beforeEach(() => {
    clearNuxtState('toasts')
  })

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

  it('annonce la réussite une fois la requête passée, et seulement alors', async () => {
    const write = useOptimisticWrite()
    const { toasts } = useToasts()

    const done = write.run({
      announce: 'toast.entrySaved',
      send: () => Promise.resolve('ok'),
    })
    expect(toasts.value).toEqual([])
    await done

    expect(toasts.value).toMatchObject([{ tone: 'success', messageKey: 'toast.entrySaved' }])
  })

  it('n’annonce pas de réussite quand la requête échoue', async () => {
    const write = useOptimisticWrite()

    await write.run({
      announce: 'toast.entrySaved',
      send: () => Promise.reject(failure('INTERNAL_ERROR')),
    })

    expect(useToasts().toasts.value).toMatchObject([{ tone: 'error' }])
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

    expect(useToasts().toasts.value).toMatchObject([
      { tone: 'error', messageKey: 'writeError.generic' },
    ])
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

    expect(useToasts().toasts.value[0]?.messageKey).toBe('writeError.signedOut')
    expect(reverts).toBe(1)
    expect(resyncs).toBe(0)
  })

  it('ne propose pas « Réessayer » pour un refus : rejouer redonnerait le même refus', async () => {
    const write = useOptimisticWrite()

    await write.run({ send: () => Promise.reject(failure('UNAUTHENTICATED')) })
    await write.run({ send: () => Promise.reject(failure('VALIDATION_ERROR')) })

    const { toasts } = useToasts()
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]).toMatchObject({ messageKey: 'writeError.generic' })
    expect(toasts.value[0]?.action).toBeUndefined()
    expect(toasts.value[0]?.hintKey).toBeUndefined()
  })

  it('reste utilisable si la resynchronisation échoue elle aussi', async () => {
    const write = useOptimisticWrite({ resync: () => Promise.reject(new Error('offline')) })

    await write.run({ send: () => Promise.reject(failure('INTERNAL_ERROR')) })

    expect(useToasts().toasts.value).toHaveLength(1)
    expect(write.isBusy.value).toBe(false)
  })

  it('retire le « Réessayer » d’un échec dès qu’une écriture plus récente est lancée', async () => {
    const write = useOptimisticWrite()
    await write.run({ send: () => Promise.reject(failure('INTERNAL_ERROR')) })
    expect(useToasts().toasts.value).toHaveLength(1)

    await write.run({ send: () => Promise.resolve() })

    expect(useToasts().toasts.value).toEqual([])
  })

  it('ne propose pas « Réessayer » quand une écriture plus récente est déjà en file', async () => {
    const write = useOptimisticWrite()

    await Promise.all([
      write.run({ send: () => Promise.reject(failure('INTERNAL_ERROR')) }),
      write.run({ send: () => Promise.resolve() }),
    ])

    const [toast] = useToasts().toasts.value
    expect(toast?.action).toBeUndefined()
  })

  it('retire l’annonce d’un échec quand une écriture suivante du même compteur réussit', async () => {
    const write = useOptimisticWrite()

    await Promise.all([
      write.run({ overwriteKey: '2:chaptersRead', send: () => Promise.reject(failure('X')) }),
      write.run({ overwriteKey: '2:chaptersRead', send: () => Promise.resolve() }),
    ])

    expect(useToasts().toasts.value).toEqual([])
  })

  it('garde l’annonce quand l’écriture suivante porte sur autre chose', async () => {
    const write = useOptimisticWrite()

    await Promise.all([
      write.run({ send: () => Promise.reject(failure('X')) }),
      write.run({ overwriteKey: '2:chaptersRead', send: () => Promise.resolve() }),
    ])
    await Promise.all([
      write.run({ overwriteKey: '2:chaptersRead', send: () => Promise.reject(failure('X')) }),
      write.run({ overwriteKey: '2:volumesRead', send: () => Promise.resolve() }),
    ])

    expect(useToasts().toasts.value).toHaveLength(1)
  })

  it('rejoue l’étape au clic sur « Réessayer » et ferme l’annonce', async () => {
    const write = useOptimisticWrite()
    const { toasts, runAction } = useToasts()
    const steps: string[] = []
    let attempts = 0

    await write.run({
      apply: () => steps.push('apply'),
      send: () => {
        attempts += 1
        return attempts === 1 ? Promise.reject(failure('INTERNAL_ERROR')) : Promise.resolve('saved')
      },
      reconcile: (result) => steps.push(`reconcile:${result}`),
      revert: () => steps.push('revert'),
    })
    runAction(toasts.value[0]!.id)
    await vi.waitFor(() => expect(steps).toContain('reconcile:saved'))

    expect(steps).toEqual(['apply', 'revert', 'apply', 'reconcile:saved'])
    expect(toasts.value).toEqual([])
  })
})
