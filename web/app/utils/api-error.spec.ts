import { describe, expect, it } from 'vitest'
import { errorMessageKey, toApiError } from './api-error'

describe('toApiError', () => {
  it('lit le code stable et le statut de la réponse', () => {
    const error = toApiError({
      response: { status: 403, _data: { code: 'ADMIN_REQUIRED', message: 'texte technique' } },
    })
    expect(error).toEqual({ status: 403, code: 'ADMIN_REQUIRED', details: undefined })
  })

  it('conserve les détails de validation', () => {
    const details = [{ path: ['title'], code: 'too_small' }]
    const error = toApiError({
      response: { status: 400, _data: { code: 'VALIDATION_ERROR', details } },
    })
    expect(error.details).toEqual(details)
  })

  it('retombe sur INTERNAL_ERROR sans corps exploitable', () => {
    expect(toApiError(new Error('réseau'))).toEqual({
      status: 0,
      code: 'INTERNAL_ERROR',
      details: undefined,
    })
    expect(toApiError(undefined).code).toBe('INTERNAL_ERROR')
  })
})

describe('errorMessageKey', () => {
  const known = (key: string) => key === 'error.ADMIN_REQUIRED' || key === 'error.INTERNAL_ERROR'

  it('renvoie la clé du code connu', () => {
    expect(errorMessageKey('ADMIN_REQUIRED', known)).toBe('error.ADMIN_REQUIRED')
  })

  it('retombe sur INTERNAL_ERROR pour un code inconnu ou absent', () => {
    expect(errorMessageKey('CODE_INCONNU', known)).toBe('error.INTERNAL_ERROR')
    expect(errorMessageKey(undefined, known)).toBe('error.INTERNAL_ERROR')
  })
})
