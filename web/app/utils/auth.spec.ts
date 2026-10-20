import { describe, expect, it } from 'vitest'
import {
  authNoticeFor,
  googleLoginUrl,
  hasSessionCookie,
  isValidHandle,
  safeReturnTo,
} from './auth'

describe('isValidHandle', () => {
  it('accepte 3 à 30 lettres, chiffres, _ et -, casse comprise', () => {
    expect(isValidHandle('Ryan')).toBe(true)
    expect(isValidHandle('lecteur_ame-2')).toBe(true)
    expect(isValidHandle('a'.repeat(30))).toBe(true)
  })

  it('refuse trop court, trop long ou un autre caractère', () => {
    expect(isValidHandle('ab')).toBe(false)
    expect(isValidHandle('a'.repeat(31))).toBe(false)
    expect(isValidHandle('mon pseudo')).toBe(false)
    expect(isValidHandle('éloïse')).toBe(false)
    expect(isValidHandle('')).toBe(false)
  })
})

describe('safeReturnTo', () => {
  it('garde un chemin du site, avec sa requête', () => {
    expect(safeReturnTo('/en/work/1-aube?x=1')).toBe('/en/work/1-aube?x=1')
  })

  it("renvoie l'accueil pour tout le reste", () => {
    expect(safeReturnTo('https://evil.test')).toBe('/')
    expect(safeReturnTo('//evil.test')).toBe('/')
    expect(safeReturnTo('/\\evil.test')).toBe('/')
    expect(safeReturnTo('relatif')).toBe('/')
    expect(safeReturnTo(`/${'a'.repeat(300)}`)).toBe('/')
    expect(safeReturnTo(undefined)).toBe('/')
    expect(safeReturnTo(42)).toBe('/')
  })

  it('lit la première valeur quand le paramètre est répété', () => {
    expect(safeReturnTo(['/search', '/autre'])).toBe('/search')
  })
})

describe('hasSessionCookie', () => {
  it('reconnaît le cookie de session parmi les autres', () => {
    expect(hasSessionCookie('trame.sid=s%3Aabc')).toBe(true)
    expect(hasSessionCookie('a=1; trame.sid=s%3Aabc; b=2')).toBe(true)
  })

  it('ne confond pas avec un autre cookie ou son absence', () => {
    expect(hasSessionCookie(undefined)).toBe(false)
    expect(hasSessionCookie('')).toBe(false)
    expect(hasSessionCookie('other.trame.sid=1; tramexsid=2')).toBe(false)
  })
})

describe('googleLoginUrl', () => {
  it('encode la page de retour', () => {
    expect(googleLoginUrl('/search?q=a%20b')).toBe(
      '/api/v1/auth/google?returnTo=%2Fsearch%3Fq%3Da%2520b',
    )
  })

  it('ne transmet jamais une adresse extérieure', () => {
    expect(googleLoginUrl('https://evil.test')).toBe('/api/v1/auth/google?returnTo=%2F')
  })
})

describe('authNoticeFor', () => {
  const known = new Set(['error.AUTH_STATE_INVALID', 'error.INTERNAL_ERROR'])
  const hasKey = (key: string) => known.has(key)

  it("jaune pour une annulation, rouge pour un code d'erreur", () => {
    expect(authNoticeFor('cancelled', hasKey)).toEqual({ key: 'auth.cancelled', tone: 'info' })
    expect(authNoticeFor('signup_cancelled', hasKey)).toEqual({
      key: 'auth.signupCancelled',
      tone: 'info',
    })
    expect(authNoticeFor('AUTH_STATE_INVALID', hasKey)).toEqual({
      key: 'error.AUTH_STATE_INVALID',
      tone: 'error',
    })
    expect(authNoticeFor('AUTRE', hasKey)).toEqual({ key: 'error.INTERNAL_ERROR', tone: 'error' })
  })

  it("ignore les noms hérités d'un objet (la valeur vient de l'adresse)", () => {
    expect(authNoticeFor('constructor', hasKey)?.key).toBe('error.INTERNAL_ERROR')
    expect(authNoticeFor('toString', hasKey)?.key).toBe('error.INTERNAL_ERROR')
  })

  it('ne dit rien sans motif', () => {
    expect(authNoticeFor(undefined, hasKey)).toBeNull()
    expect(authNoticeFor('', hasKey)).toBeNull()
    expect(authNoticeFor(['cancelled'], hasKey)?.key).toBe('auth.cancelled')
  })
})
