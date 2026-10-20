import { describe, expect, it } from 'vitest'
import { forwardedFor, judgeRelayRequest } from './api-relay'

describe('judgeRelayRequest', () => {
  it('laisse passer les lectures', () => {
    expect(judgeRelayRequest('GET', 'works')).toBe('allowed')
    expect(judgeRelayRequest('HEAD', 'works/1')).toBe('allowed')
  })

  it("n'autorise les écritures que sous /auth", () => {
    expect(judgeRelayRequest('POST', 'auth/handle')).toBe('allowed')
    expect(judgeRelayRequest('POST', 'works')).toBe('method-not-allowed')
    expect(judgeRelayRequest('POST', 'authors/1')).toBe('method-not-allowed')
  })

  it('refuse les autres méthodes', () => {
    expect(judgeRelayRequest('DELETE', 'auth/handle')).toBe('method-not-allowed')
    expect(judgeRelayRequest('PUT', 'works/1')).toBe('method-not-allowed')
  })

  it('refuse un chemin qui remonte', () => {
    expect(judgeRelayRequest('GET', 'works/../admin')).toBe('bad-request')
    expect(judgeRelayRequest('POST', 'auth/../works')).toBe('bad-request')
  })
})

describe('forwardedFor', () => {
  it("ajoute l'adresse du visiteur à la chaîne reçue", () => {
    expect(forwardedFor('203.0.113.9', '198.51.100.4')).toBe('203.0.113.9, 198.51.100.4')
  })

  it("part de l'adresse du visiteur quand aucune chaîne n'est reçue", () => {
    expect(forwardedFor(undefined, '198.51.100.4')).toBe('198.51.100.4')
  })

  it("n'envoie rien sans aucune adresse", () => {
    expect(forwardedFor(undefined, undefined)).toBeUndefined()
    expect(forwardedFor('', undefined)).toBeUndefined()
  })
})
