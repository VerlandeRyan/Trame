/** Session cookie configuration and the session middleware. */
import session from 'express-session';
import type { RequestHandler } from 'express';
import type { SessionStore } from './store.js';

/** Session cookie name without the secure prefix. */
const SESSION_COOKIE_BASE_NAME = 'trame.sid';

/** The `__Host-` prefix requires `Secure`: without it (local HTTP, E2E) the browser would reject the cookie. */
export function sessionCookieName(secureCookies: boolean): string {
  return secureCookies ? `__Host-${SESSION_COOKIE_BASE_NAME}` : SESSION_COOKIE_BASE_NAME;
}

/** Lifetime of a full sign-in session, extended on every visit (rolling session). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Same attributes as the session cookie, to clear it on sign-out. `__Host-` requires `Path=/` and no `Domain`. */
export function cookieOptions(secureCookies: boolean) {
  return { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' } as const;
}

/** Creates the session middleware backed by the database store. */
export function createSessionMiddleware(options: {
  store: SessionStore;
  secret: string;
  secureCookies: boolean;
}): RequestHandler {
  return session({
    name: sessionCookieName(options.secureCookies),
    store: options.store,
    secret: options.secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { ...cookieOptions(options.secureCookies), maxAge: SESSION_TTL_MS },
  });
}
