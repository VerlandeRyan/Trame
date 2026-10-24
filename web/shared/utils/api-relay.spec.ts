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

  it("autorise l'écriture de la liste de lecture sur une œuvre seulement", () => {
    expect(judgeRelayRequest('PUT', 'works/12/entry')).toBe('allowed')
    expect(judgeRelayRequest('DELETE', 'works/12/entry')).toBe('allowed')
    expect(judgeRelayRequest('POST', 'works/12/entry')).toBe('method-not-allowed')
    expect(judgeRelayRequest('PUT', 'works/abc/entry')).toBe('method-not-allowed')
    expect(judgeRelayRequest('PUT', 'works/12/entry/extra')).toBe('method-not-allowed')
  })

  it('autorise le réglage de visibilité de son profil, et rien d’autre sous /me', () => {
    expect(judgeRelayRequest('PATCH', 'me/profile')).toBe('allowed')
    expect(judgeRelayRequest('PUT', 'me/profile')).toBe('method-not-allowed')
    expect(judgeRelayRequest('PATCH', 'me/entries')).toBe('method-not-allowed')
  })

  it("autorise les écritures d'administration du catalogue, et rien d'autre sous /admin", () => {
    expect(judgeRelayRequest('POST', 'admin/works')).toBe('allowed')
    expect(judgeRelayRequest('PUT', 'admin/people/7')).toBe('allowed')
    expect(judgeRelayRequest('POST', 'admin/publishers/7/archive')).toBe('allowed')
    expect(judgeRelayRequest('POST', 'admin/works/7/restore')).toBe('allowed')
    expect(judgeRelayRequest('DELETE', 'admin/works/7')).toBe('method-not-allowed')
    expect(judgeRelayRequest('PUT', 'admin/works')).toBe('method-not-allowed')
    expect(judgeRelayRequest('POST', 'admin/works/7/purge')).toBe('method-not-allowed')
    expect(judgeRelayRequest('POST', 'admin/genres')).toBe('method-not-allowed')
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
