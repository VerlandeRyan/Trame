import { afterEach, describe, expect, it, vi } from 'vitest'

const failure = (code: string) => ({ status: 500, code })

describe('useWriteFailure', () => {
  afterEach(() => {
    const { toasts, dismiss } = useToasts()
    for (const toast of [...toasts.value]) dismiss(toast.id)
  })

  it('propose « Réessayer » et le conseil pour une panne passagère', () => {
    const { toasts } = useToasts()
    const showWriteFailure = useWriteFailure()
    const replay = vi.fn()

    showWriteFailure(failure('INTERNAL_ERROR'), replay)

    expect(toasts.value).toMatchObject([
      {
        tone: 'error',
        messageKey: 'writeError.generic',
        hintKey: 'writeError.retryHint',
        retry: replay,
      },
    ])
  })

  it('annonce un refus sans « Réessayer » ni conseil : rejouer redonnerait le même refus', () => {
    const { toasts } = useToasts()
    const showWriteFailure = useWriteFailure()

    showWriteFailure(failure('UNAUTHENTICATED'), vi.fn())
    showWriteFailure(failure('VALIDATION_ERROR'), vi.fn())

    expect(toasts.value).toMatchObject([
      { messageKey: 'writeError.signedOut' },
      { messageKey: 'writeError.generic' },
    ])
    for (const toast of toasts.value) {
      expect(toast.retry).toBeUndefined()
      expect(toast.hintKey).toBeUndefined()
    }
  })

  it('n’a pas de « Réessayer » quand l’appelant n’en donne pas', () => {
    const { toasts } = useToasts()
    const showWriteFailure = useWriteFailure()

    showWriteFailure(failure('INTERNAL_ERROR'))

    expect(toasts.value[0]?.retry).toBeUndefined()
  })

  it('n’offre plus « Réessayer » ni conseil quand la page a été quittée avant l’échec', async () => {
    const { toasts } = useToasts()
    const router = useRouter()
    const blank = { render: () => null }
    router.addRoute({ path: '/write-failure-start', component: blank })
    router.addRoute({ path: '/write-failure-elsewhere', component: blank })
    await router.push('/write-failure-start')
    const showWriteFailure = useWriteFailure()
    await router.push('/write-failure-elsewhere')

    showWriteFailure(failure('INTERNAL_ERROR'), vi.fn())

    expect(toasts.value[0]).toMatchObject({ messageKey: 'writeError.generic' })
    expect(toasts.value[0]?.retry).toBeUndefined()
    expect(toasts.value[0]?.hintKey).toBeUndefined()
  })

  it('traite une erreur qui n’est pas une erreur d’API comme une panne du serveur', () => {
    const { toasts } = useToasts()
    const showWriteFailure = useWriteFailure()

    showWriteFailure(new Error('réseau coupé'), vi.fn())

    expect(toasts.value[0]).toMatchObject({
      messageKey: 'writeError.generic',
      hintKey: 'writeError.retryHint',
    })
    expect(toasts.value[0]?.retry).toBeTypeOf('function')
  })

  it('utilise le message de l’appelant quand il en donne un', () => {
    const { toasts } = useToasts()
    const showWriteFailure = useWriteFailure()

    showWriteFailure(failure('INTERNAL_ERROR'), vi.fn(), 'profile.visibility.error')

    expect(toasts.value[0]).toMatchObject({ messageKey: 'profile.visibility.error' })
  })
})
