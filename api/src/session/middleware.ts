import session from 'express-session';
import type { RequestHandler } from 'express';
import type { SessionStore } from './store.js';

export const SESSION_COOKIE_NAME = 'trame.sid';

/** Durée d'une session de connexion complète, prolongée à chaque visite (session glissante). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** `Secure` hors développement local. */
export function cookieOptions(secureCookies: boolean) {
  return { httpOnly: true, sameSite: 'lax', secure: secureCookies } as const;
}

export function createSessionMiddleware(options: {
  store: SessionStore;
  secret: string;
  secureCookies: boolean;
}): RequestHandler {
  return session({
    name: SESSION_COOKIE_NAME,
    store: options.store,
    secret: options.secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { ...cookieOptions(options.secureCookies), maxAge: SESSION_TTL_MS },
  });
}
