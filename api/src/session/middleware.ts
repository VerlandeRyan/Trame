import session from 'express-session';
import type { RequestHandler } from 'express';
import type { SessionStore } from './store.js';

export const SESSION_COOKIE_NAME = 'trame.sid';

/** Durée d'une session de connexion complète, prolongée à chaque visite (session glissante). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Mêmes attributs que le cookie de session, pour l'effacer à la déconnexion. */
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
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.secureCookies,
      maxAge: SESSION_TTL_MS,
    },
  });
}
