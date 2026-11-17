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

  it('ferme l’annonce puis rejoue l’action au clic sur « Réessayer »', () => {
    const { toasts, show, retry } = useToasts()
    const action = vi.fn()
    const id = show({ tone: 'error', messageKey: 'a', retry: action })

    retry(id)

    expect(action).toHaveBeenCalledOnce()
    expect(toasts.value).toEqual([])
  })
})
