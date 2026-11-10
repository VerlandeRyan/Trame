/** HTTP controller of the Google sign-in flow, account creation and sign-out. */
import type { Request, RequestHandler } from 'express';
import { SUPPORTED_LANGUAGES } from '../config.js';
import { AppError } from '../errors.js';
import { validated } from '../middleware/validate.js';
import { callbackQuery, handleBody, loginQuery } from '../schemas/auth.js';
import {
  PENDING_SIGNUP_TTL_MS,
  type AuthService,
  type AuthStatus,
} from '../services/auth.service.js';
import type { GoogleIdentity } from '../services/google-identity.js';
import { SESSION_TTL_MS, cookieOptions, sessionCookieName } from '../session/middleware.js';
import { destroySession, regenerateSession, saveSession } from '../session/session-actions.js';

/** Front-end page paths the flow redirects to. */
const HOME_PATH = '/';
const HANDLE_PATH = '/signup/handle';

/** French has no URL prefix; the other languages do (`/en/…`). */
const DEFAULT_LANGUAGE = 'fr';
const PREFIXED_LANGUAGES: ReadonlySet<string> = new Set(
  SUPPORTED_LANGUAGES.filter((language) => language !== DEFAULT_LANGUAGE),
);

/** Language prefix of the originating page (`/en`), to keep the journey in that language. */
function localePrefix(returnTo?: string): string {
  const firstSegment = returnTo?.split(/[/?#]/)[1] ?? '';
  return PREFIXED_LANGUAGES.has(firstSegment) ? `/${firstSegment}` : '';
}

/** Appends `returnTo` so the front end can send the user back once the handle is chosen. */
function withReturnTo(path: string, returnTo?: string): string {
  return returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path;
}

/** Opens a fresh session (new identifier) for a signed-in user or one waiting to choose a handle. */
async function openSession(
  req: Request,
  content: { userId: number } | { pending: GoogleIdentity },
  ttlMs: number,
): Promise<void> {
  await regenerateSession(req);
  Object.assign(req.session, content);
  req.session.cookie.maxAge = ttlMs;
  await saveSession(req);
}

/** Builds the authentication request handlers. */
export function createAuthController(
  service: AuthService,
  options: { webOrigin: string; secureCookies: boolean },
): {
  startGoogleLogin: RequestHandler;
  finishGoogleLogin: RequestHandler;
  getAuthStatus: RequestHandler;
  createAccount: RequestHandler;
  signOut: RequestHandler;
} {
  const { webOrigin, secureCookies } = options;

  return {
    async startGoogleLogin(req, res) {
      const { returnTo } = validated(loginQuery, req.query);
      const { url, state, ...secrets } = await service.startLogin();
      req.session.oauth = { state, secrets, returnTo };
      await saveSession(req);
      res.redirect(url);
    },

    async finishGoogleLogin(req, res) {
      const { code, state, error } = validated(callbackQuery, req.query);
      const attempt = req.session.oauth;
      /** Redirects the browser to a page of the front end. */
      const backToFront = (path: string) => res.redirect(`${webOrigin}${path}`);
      /** Sends the user back to the home page with the reason of the failure. */
      const fail = (reason: string) =>
        backToFront(`${localePrefix(attempt?.returnTo)}${HOME_PATH}?auth_error=${reason}`);

      if (error !== undefined) return fail('cancelled');
      if (!attempt || !code || state !== attempt.state) return fail('AUTH_STATE_INVALID');
      delete req.session.oauth;

      const { returnTo } = attempt;
      try {
        const outcome = await service.finishLogin(code, attempt.secrets);
        if (outcome.kind === 'existing') {
          await openSession(req, { userId: outcome.user.id }, SESSION_TTL_MS);
          return backToFront(returnTo ?? HOME_PATH);
        }
        await openSession(req, { pending: outcome.identity }, PENDING_SIGNUP_TTL_MS);
        return backToFront(withReturnTo(`${localePrefix(returnTo)}${HANDLE_PATH}`, returnTo));
      } catch (err) {
        if (err instanceof AppError) return fail(err.code);
        throw err;
      }
    },

    getAuthStatus(req, res) {
      let body: AuthStatus = { status: 'anonymous' };
      if (req.user) body = { status: 'authenticated', user: req.user };
      else if (req.hasPendingSignup) body = { status: 'pending' };
      res.json(body);
    },

    async createAccount(req, res) {
      const { pending } = req.session;
      if (!pending) throw new AppError('SIGNUP_EXPIRED');
      const { handle } = validated(handleBody, req.body);
      const user = await service.createAccount(pending, handle);
      await openSession(req, { userId: user.id }, SESSION_TTL_MS);
      res.status(201).json({ status: 'authenticated', user });
    },

    /** Signs out, or abandons a pending sign-up. */
    async signOut(req, res) {
      await destroySession(req);
      res.clearCookie(sessionCookieName(secureCookies), cookieOptions(secureCookies));
      res.status(204).end();
    },
  };
}
