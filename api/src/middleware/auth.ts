import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors.js';
import type { AuthUser } from '../repositories/user.repository.js';
import type { GoogleIdentity, GoogleSecrets } from '../services/google-identity.js';
import { destroySession } from '../session/session-actions.js';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    /** Identité Google validée, en attente du choix du handle. */
    pending?: GoogleIdentity;
    /** Connexion Google en cours : `state` et secrets à retrouver au retour, page où revenir ensuite. */
    oauth?: { state: string; secrets: GoogleSecrets; returnTo?: string };
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    hasPendingSignup?: boolean;
  }
}

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Anti-CSRF : une requête qui n'est pas une lecture doit venir du front. On se fie à `Origin` ;
 * à défaut, le navigateur dit lui-même si la requête vient d'un autre site (`Sec-Fetch-Site`).
 * Les outils qui n'envoient aucun de ces en-têtes passent.
 */
export function checkOrigin(allowedOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (READ_ONLY_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    const fromFront =
      origin === undefined ? req.get('sec-fetch-site') !== 'cross-site' : origin === allowedOrigin;
    next(fromFront ? undefined : new AppError('FORBIDDEN_ORIGIN'));
  };
}

/** Seul endroit qui lit la session pour savoir qui est là : les routes ne regardent que `req.user`. */
export function attachUser(findUser: (id: number) => Promise<AuthUser | null>): RequestHandler {
  async function loadUser(req: Request, userId: number): Promise<void> {
    const user = await findUser(userId);
    if (user) req.user = user;
    else await destroySession(req);
  }

  return async (req, _res, next) => {
    try {
      const { userId, pending } = req.session;
      if (userId !== undefined) await loadUser(req, userId);
      else if (pending) req.hasPendingSignup = true;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function missingUserError(req: Request): AppError {
  return new AppError(req.hasPendingSignup ? 'HANDLE_REQUIRED' : 'UNAUTHENTICATED');
}

/** Utilisateur de la requête, pour une route déjà protégée par `requireUser` ou `requireAdmin`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw missingUserError(req);
  return req.user;
}

export const requireUser: RequestHandler = (req, _res, next) => {
  next(req.user ? undefined : missingUserError(req));
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(missingUserError(req));
  next(req.user.role === 'admin' ? undefined : new AppError('ADMIN_REQUIRED'));
};
