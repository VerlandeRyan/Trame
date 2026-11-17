import { describe, expect, it } from 'vitest'
import { writeErrorHintKey, writeErrorKey } from './write-errors'

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
