import session from 'express-session';
import type { RequestHandler } from 'express';
import type { SessionStore } from './store.js';

const SESSION_COOKIE_BASE_NAME = 'trame.sid';

/** Le préfixe `__Host-` impose `Secure` : sans lui (HTTP local, E2E) le navigateur refuserait le cookie. */
export function sessionCookieName(secureCookies: boolean): string {
  return secureCookies ? `__Host-${SESSION_COOKIE_BASE_NAME}` : SESSION_COOKIE_BASE_NAME;
}

/** Durée d'une session de connexion complète, prolongée à chaque visite (session glissante). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Mêmes attributs que le cookie de session, pour l'effacer à la déconnexion. `__Host-` exige `Path=/` et aucun `Domain`. */
export function cookieOptions(secureCookies: boolean) {
  return { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' } as const;
}

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
