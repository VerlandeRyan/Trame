import { afterEach, describe, expect, it, vi } from 'vitest'

describe('useToasts', () => {
  afterEach(() => {
    const { toasts, dismiss } = useToasts()
    for (const toast of [...toasts.value]) dismiss(toast.id)
  })

  it('affiche une annonce avec son ton et son texte', () => {
    const { toasts, show } = useToasts()

    show({ tone: 'error', messageKey: 'writeError.generic' })

    expect(toasts.value).toMatchObject([{ tone: 'error', messageKey: 'writeError.generic' }])
  })

  it('se ferme à la demande', () => {
    const { toasts, show, dismiss } = useToasts()
    const id = show({ tone: 'error', messageKey: 'a' })

    dismiss(id)

    expect(toasts.value).toEqual([])
  })

  it('remplace une annonce identique par la plus récente', () => {
    const { toasts, show } = useToasts()
    const first = show({ tone: 'info', messageKey: 'a' })

    const second = show({ tone: 'info', messageKey: 'a' })

    expect(toasts.value.map((each) => each.id)).toEqual([second])
    expect(second).not.toBe(first)
  })

  it('ferme les annonces à « Réessayer » et garde les autres', () => {
    const { toasts, show, dismissActionable } = useToasts()
    show({ tone: 'error', messageKey: 'a', action: { kind: 'retry', run: vi.fn() } })
    const plain = show({ tone: 'error', messageKey: 'b' })

    dismissActionable()

    expect(toasts.value.map((each) => each.id)).toEqual([plain])
  })

  it('ferme l’annonce puis lance l’action de son bouton, « Réessayer » ou « Annuler »', () => {
    const { toasts, show, runAction } = useToasts()
    const retry = vi.fn()
    const undo = vi.fn()
    const retryId = show({ tone: 'error', messageKey: 'a', action: { kind: 'retry', run: retry } })
    const undoId = show({ tone: 'success', messageKey: 'b', action: { kind: 'undo', run: undo } })

    runAction(retryId)
    expect(retry).toHaveBeenCalledOnce()
    expect(toasts.value.map((each) => each.id)).toEqual([undoId])

    runAction(undoId)
    expect(undo).toHaveBeenCalledOnce()
    expect(toasts.value).toEqual([])
  })

  it('ferme aussi une annonce à « Annuler » quand la page change, et garde une réussite simple', () => {
    const { toasts, show, dismissActionable } = useToasts()
    show({ tone: 'success', messageKey: 'a', action: { kind: 'undo', run: vi.fn() } })
    const plain = show({ tone: 'success', messageKey: 'b' })

    dismissActionable()

    expect(toasts.value.map((each) => each.id)).toEqual([plain])
  })
})
