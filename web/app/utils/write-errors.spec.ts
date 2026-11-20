import { describe, expect, it } from 'vitest'
import { describeWriteFailure, RETRY_HINT_KEY } from './write-errors'

describe('describeWriteFailure', () => {
  it('ne propose de réessayer que pour une panne passagère', () => {
    expect(describeWriteFailure('INTERNAL_ERROR').isRetryable).toBe(true)
    expect(describeWriteFailure('RATE_LIMITED').isRetryable).toBe(true)
  })

  it('n’en propose pas pour un refus qu’il faut corriger ou qui ne passera pas', () => {
    for (const code of [
      'VALIDATION_ERROR',
      'STALE_RECORD',
      'DRAFT_REFERENCE',
      'NOT_FOUND',
      'UNAUTHENTICATED',
    ] as const) {
      expect(describeWriteFailure(code).isRetryable).toBe(false)
    }
  })

  it('traduit les codes connus et se replie sur un message générique', () => {
    expect(describeWriteFailure('UNAUTHENTICATED').messageKey).toBe('writeError.signedOut')
    expect(describeWriteFailure('HANDLE_REQUIRED').messageKey).toBe('writeError.signedOut')
    expect(describeWriteFailure('NOT_FOUND').messageKey).toBe('writeError.notFound')
    expect(describeWriteFailure('RATE_LIMITED').messageKey).toBe('error.RATE_LIMITED')
    expect(describeWriteFailure('INTERNAL_ERROR').messageKey).toBe('writeError.generic')
    expect(describeWriteFailure('VALIDATION_ERROR').messageKey).toBe('writeError.generic')
  })

  it('ne conseille de réessayer que pour le message générique d’une panne passagère', () => {
    expect(describeWriteFailure('INTERNAL_ERROR').hintKey).toBe(RETRY_HINT_KEY)
    for (const code of [
      'RATE_LIMITED',
      'UNAUTHENTICATED',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'STALE_RECORD',
    ] as const) {
      expect(describeWriteFailure(code).hintKey).toBeUndefined()
    }
  })
})
