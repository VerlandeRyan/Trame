/** Sign-in helpers: handle format, safe return paths, notices and session cookie detection. */
import type { AuthState } from '../contract/api'
import { errorMessageKey } from './api-error'

/** Auth status; `pending`: Google identity verified, handle still to choose. */
export type { AuthState, AuthUser } from '../contract/api'

/** State of a visitor who is not signed in. */
export const ANONYMOUS: AuthState = { status: 'anonymous' }

// Same format as the API; reserved words are only known to it.
export const HANDLE_MIN_LENGTH = 3
export const HANDLE_MAX_LENGTH = 30
const HANDLE_PATTERN = /^[A-Za-z0-9_-]+$/
const HOME_PATH = '/'
/** A path of this site only: starts with a single slash, printable characters. */
const RETURN_TO_PATTERN = /^\/(?![/\\])[\x21-\x7e]*$/
const RETURN_TO_MAX_LENGTH = 300

/** Whether the handle has an allowed length and characters. */
export function isValidHandle(handle: string): boolean {
  return (
    handle.length >= HANDLE_MIN_LENGTH &&
    handle.length <= HANDLE_MAX_LENGTH &&
    HANDLE_PATTERN.test(handle)
  )
}

/** Page to return to after sign-in: a path of this site only, otherwise the home page. */
export function safeReturnTo(raw: unknown): string {
  const path = Array.isArray(raw) ? raw[0] : raw
  const valid =
    typeof path === 'string' && path.length <= RETURN_TO_MAX_LENGTH && RETURN_TO_PATTERN.test(path)
  return valid ? path : HOME_PATH
}

/** Address that starts the Google sign-in (full navigation, relayed to the API). */
export function googleLoginUrl(returnTo: string): string {
  return `/api/v1/auth/google?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`
}

/** Banner: translation key and tone (yellow for information, green for success, red for an error). */
export interface AuthNotice {
  key: string
  tone: 'info' | 'success' | 'error'
  /** Notice set just before a redirect: it survives that address change, not the next one. */
  keepOnce?: boolean
}

/** Reason recorded when a visitor abandons the sign-up. */
export const SIGNUP_CANCELLED = 'signup_cancelled'
// A `Map`: the value comes from the address, so `constructor` or `toString` must find nothing.
const INFO_NOTICE_KEYS = new Map([
  ['cancelled', 'auth.cancelled'],
  [SIGNUP_CANCELLED, 'auth.signupCancelled'],
])

/** Banner requested by the `auth_error` query: a cancellation (info) or an API error code (error). */
export function authNoticeFor(raw: unknown, hasKey: (key: string) => boolean): AuthNotice | null {
  const reason = Array.isArray(raw) ? raw[0] : raw
  if (typeof reason !== 'string' || reason === '') return null
  const infoKey = INFO_NOTICE_KEYS.get(reason)
  return infoKey
    ? { key: infoKey, tone: 'info' }
    : { key: errorMessageKey(reason, hasKey), tone: 'error' }
}

// The API sets `__Host-trame.sid` in production (Secure cookie) and `trame.sid` on local HTTP.
const SESSION_COOKIE_PREFIXES = ['trame.sid=', '__Host-trame.sid=']

/** Without a session cookie there is no point asking the API who is signed in. */
export function hasSessionCookie(cookieHeader: string | undefined): boolean {
  return (cookieHeader ?? '')
    .split(';')
    .some((cookie) => SESSION_COOKIE_PREFIXES.some((prefix) => cookie.trim().startsWith(prefix)))
}

/** A slow API must not block page rendering. */
export const AUTH_STATUS_TIMEOUT_MS = 3000
