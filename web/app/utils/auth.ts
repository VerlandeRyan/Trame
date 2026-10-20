import { errorMessageKey } from './api-error'

export interface AuthUser {
  id: number
  handle: string
  role: 'user' | 'admin'
}

/** Réponse de `GET /auth/me` ; `pending` : identité Google validée, pseudo à choisir. */
export type AuthState =
  { status: 'anonymous' } | { status: 'pending' } | { status: 'authenticated'; user: AuthUser }

export const ANONYMOUS: AuthState = { status: 'anonymous' }

// Même format que l'API ; les mots réservés ne sont connus que d'elle.
export const HANDLE_MIN_LENGTH = 3
export const HANDLE_MAX_LENGTH = 30
const HANDLE_PATTERN = /^[A-Za-z0-9_-]+$/
const HOME_PATH = '/'
const RETURN_TO_PATTERN = /^\/(?![/\\])[\x21-\x7e]*$/
const RETURN_TO_MAX_LENGTH = 300

export function isValidHandle(handle: string): boolean {
  return (
    handle.length >= HANDLE_MIN_LENGTH &&
    handle.length <= HANDLE_MAX_LENGTH &&
    HANDLE_PATTERN.test(handle)
  )
}

/** Page où revenir après la connexion : un chemin du site seulement, sinon l'accueil. */
export function safeReturnTo(raw: unknown): string {
  const path = Array.isArray(raw) ? raw[0] : raw
  const valid =
    typeof path === 'string' && path.length <= RETURN_TO_MAX_LENGTH && RETURN_TO_PATTERN.test(path)
  return valid ? path : HOME_PATH
}

/** Adresse qui lance la connexion Google (navigation complète, relayée vers l'API). */
export function googleLoginUrl(returnTo: string): string {
  return `/api/v1/auth/google?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`
}

/** Bandeau : clé de traduction ; jaune pour une information, vert pour une réussite, rouge pour une erreur. */
export interface AuthNotice {
  key: string
  tone: 'info' | 'success' | 'error'
}

export const SIGNUP_CANCELLED = 'signup_cancelled'
// Une `Map` : la valeur vient de l'adresse, `constructor` ou `toString` ne doivent rien trouver.
const INFO_NOTICE_KEYS = new Map([
  ['cancelled', 'auth.cancelled'],
  [SIGNUP_CANCELLED, 'auth.signupCancelled'],
])

/** Bandeau demandé par `/?auth_error=…` : annulation (info) ou code d'erreur de l'API (erreur). */
export function authNoticeFor(raw: unknown, hasKey: (key: string) => boolean): AuthNotice | null {
  const reason = Array.isArray(raw) ? raw[0] : raw
  if (typeof reason !== 'string' || reason === '') return null
  const infoKey = INFO_NOTICE_KEYS.get(reason)
  return infoKey
    ? { key: infoKey, tone: 'info' }
    : { key: errorMessageKey(reason, hasKey), tone: 'error' }
}

const SESSION_COOKIE_PREFIX = 'trame.sid='

/** Sans cookie de session, inutile de demander à l'API qui est connecté. */
export function hasSessionCookie(cookieHeader: string | undefined): boolean {
  return (cookieHeader ?? '')
    .split(';')
    .some((cookie) => cookie.trim().startsWith(SESSION_COOKIE_PREFIX))
}

/** Une API lente ne doit pas bloquer le rendu des pages. */
export const AUTH_STATUS_TIMEOUT_MS = 3000
