/** Authentication middleware: origin check, loading the signed-in user and access guards. */
import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors.js';
import type { AuthUser } from '../repositories/user.repository.js';
import type { GoogleIdentity, GoogleSecrets } from '../services/google-identity.js';
import { destroySession } from '../session/session-actions.js';

declare module 'express-session' {
  /** What the application stores in a session. */
  interface SessionData {
    userId?: number;
    /** Verified Google identity, waiting for the handle to be chosen. */
    pending?: GoogleIdentity;
    /** Google sign-in in progress: `state` and secrets to find again on return, and the page to go back to. */
    oauth?: { state: string; secrets: GoogleSecrets; returnTo?: string };
  }
}

declare module 'express-serve-static-core' {
  /** What the authentication middleware adds to a request. */
  interface Request {
    user?: AuthUser;
    hasPendingSignup?: boolean;
  }
}

/** HTTP methods that never change data. */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection: a request that is not a read must come from the front end. `Origin` is trusted;
 * without it, the browser says itself whether the request comes from another site (`Sec-Fetch-Site`).
 * Tools that send neither header pass.
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

/** The only place that reads the session to know who is there: routes only look at `req.user`. */
export function attachUser(findUser: (id: number) => Promise<AuthUser | null>): RequestHandler {
  /** Sets `req.user`, or drops the session when the account no longer exists. */
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

/** Error for a request without a user: handle still to choose, or not signed in. */
function missingUserError(req: Request): AppError {
  return new AppError(req.hasPendingSignup ? 'HANDLE_REQUIRED' : 'UNAUTHENTICATED');
}

/** User of the request, for a route already protected by `requireUser` or `requireAdmin`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw missingUserError(req);
  return req.user;
}

/** Guard: lets signed-in users through. */
export const requireUser: RequestHandler = (req, _res, next) => {
  next(req.user ? undefined : missingUserError(req));
};

/** Guard: lets administrators through. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(missingUserError(req));
  next(req.user.role === 'admin' ? undefined : new AppError('ADMIN_REQUIRED'));
};
