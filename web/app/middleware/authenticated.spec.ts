import { afterEach, describe, expect, it } from 'vitest'
import { ANONYMOUS, type AuthState } from '~/utils/auth'
import guard from './authenticated'

const callGuard = () => (guard as (...args: unknown[]) => unknown)({}, {})

describe('garde des pages réservées aux membres', () => {
  afterEach(() => {
    useState<AuthState>('auth').value = ANONYMOUS
    useSignInModal().value = false
  })

  it('laisse passer un membre connecté', () => {
    useState<AuthState>('auth').value = {
      status: 'authenticated',
      user: { id: 1, handle: 'lectrice', role: 'user' },
    }

    expect(callGuard()).toBeUndefined()
    expect(useSignInModal().value).toBe(false)
  })

  it('renvoie un visiteur à l’accueil et ouvre la fenêtre de connexion', () => {
    useState<AuthState>('auth').value = ANONYMOUS

    expect(callGuard()).toBeDefined()
    expect(useSignInModal().value).toBe(true)
  })
})
