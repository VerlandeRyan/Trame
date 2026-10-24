import { afterEach, describe, expect, it } from 'vitest'
import { ANONYMOUS, type AuthState } from '~/utils/auth'
import guard from './admin'

const callGuard = () => (guard as (...args: unknown[]) => unknown)({}, {})

describe('garde des pages d’administration', () => {
  afterEach(() => {
    useState<AuthState>('auth').value = ANONYMOUS
    useSignInModal().value = false
  })

  it('laisse passer un administrateur', () => {
    useState<AuthState>('auth').value = {
      status: 'authenticated',
      user: { id: 1, handle: 'ryan', role: 'admin' },
    }

    expect(callGuard()).toBeUndefined()
  })

  it('répond 404 à un membre qui n’est pas administrateur', () => {
    useState<AuthState>('auth').value = {
      status: 'authenticated',
      user: { id: 2, handle: 'lectrice', role: 'user' },
    }

    expect(callGuard).toThrow(expect.objectContaining({ statusCode: 404 }))
  })

  it('renvoie un visiteur à l’accueil et ouvre la fenêtre de connexion', () => {
    expect(callGuard()).toBeDefined()
    expect(useSignInModal().value).toBe(true)
  })
})
