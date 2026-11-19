import { describe, expect, it } from 'vitest'
import { isRetryable, writeErrorHintKey, writeErrorKey } from './write-errors'

describe('isRetryable', () => {
  it('ne propose de réessayer que pour une panne passagère', () => {
    expect(isRetryable('INTERNAL_ERROR')).toBe(true)
    expect(isRetryable('RATE_LIMITED')).toBe(true)
  })

  it('n’en propose pas pour un refus qu’il faut corriger', () => {
    for (const code of ['VALIDATION_ERROR', 'STALE_RECORD', 'DRAFT_REFERENCE', 'NOT_FOUND']) {
      expect(isRetryable(code)).toBe(false)
    }
  })
})

describe('writeErrorKey', () => {
  it('traduit les codes connus et se replie sur un message générique', () => {
    expect(writeErrorKey('UNAUTHENTICATED')).toBe('writeError.signedOut')
    expect(writeErrorKey('NOT_FOUND')).toBe('writeError.notFound')
    expect(writeErrorKey('RATE_LIMITED')).toBe('error.RATE_LIMITED')
    expect(writeErrorKey('INTERNAL_ERROR')).toBe('writeError.generic')
    expect(writeErrorKey('constructor')).toBe('writeError.generic')
  })
})

describe('writeErrorHintKey', () => {
  it('ne conseille de réessayer que pour le message générique', () => {
    expect(writeErrorHintKey('INTERNAL_ERROR')).toBe('writeError.retryHint')
    expect(writeErrorHintKey('UNAUTHENTICATED')).toBeUndefined()
    expect(writeErrorHintKey('NOT_FOUND')).toBeUndefined()
  })
})
