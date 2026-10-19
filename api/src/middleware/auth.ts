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

/** Anti-CSRF : toute requête qui n'est pas une lecture et porte un `Origin` doit venir du front. */
export function checkOrigin(allowedOrigin: string): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    const foreign = origin !== undefined && origin !== allowedOrigin;
    next(
      !READ_ONLY_METHODS.has(req.method) && foreign ? new AppError('FORBIDDEN_ORIGIN') : undefined,
    );
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

export const requireUser: RequestHandler = (req, _res, next) => {
  next(req.user ? undefined : missingUserError(req));
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(missingUserError(req));
  next(req.user.role === 'admin' ? undefined : new AppError('ADMIN_REQUIRED'));
};
