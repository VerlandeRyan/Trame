import type { Request, RequestHandler } from 'express';
import { SUPPORTED_LANGUAGES } from '../config.js';
import { AppError } from '../errors.js';
import {
  PENDING_SIGNUP_TTL_MS,
  type AuthService,
  type AuthStatus,
} from '../services/auth.service.js';
import type { GoogleIdentity } from '../services/google-identity.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS, cookieOptions } from '../session/middleware.js';
import { destroySession, regenerateSession, saveSession } from '../session/session-actions.js';

const HOME_PATH = '/';
const HANDLE_PATH = '/signup/handle';

// Le français n'a pas de préfixe d'URL, les autres langues en ont un (`/en/…`).
const DEFAULT_LANGUAGE = 'fr';
const PREFIXED_LANGUAGES: ReadonlySet<string> = new Set(
  SUPPORTED_LANGUAGES.filter((language) => language !== DEFAULT_LANGUAGE),
);

/** Préfixe de langue de la page d'origine (`/en`), pour garder le parcours dans cette langue. */
function localePrefix(returnTo?: string): string {
  const firstSegment = returnTo?.split(/[/?#]/)[1] ?? '';
  return PREFIXED_LANGUAGES.has(firstSegment) ? `/${firstSegment}` : '';
}

/** Le front renvoie l'utilisateur vers `returnTo` une fois son handle choisi. */
function withReturnTo(path: string, returnTo?: string): string {
  return returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path;
}

/** Ouvre une session neuve (nouvel identifiant) pour un utilisateur connecté ou en attente de handle. */
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
      const { returnTo } = req.query as { returnTo?: string };
      const { url, state, ...secrets } = await service.startLogin();
      req.session.oauth = { state, secrets, returnTo };
      await saveSession(req);
      res.redirect(url);
    },

    async finishGoogleLogin(req, res) {
      const { code, state, error } = req.query as Record<string, string | undefined>;
      const attempt = req.session.oauth;
      const backToFront = (path: string) => res.redirect(`${webOrigin}${path}`);
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
      const { handle } = req.body as { handle: string };
      const user = await service.createAccount(pending, handle);
      await openSession(req, { userId: user.id }, SESSION_TTL_MS);
      res.status(201).json({ status: 'authenticated', user });
    },

    /** Déconnexion, ou abandon d'une inscription en attente. */
    async signOut(req, res) {
      await destroySession(req);
      res.clearCookie(SESSION_COOKIE_NAME, cookieOptions(secureCookies));
      res.status(204).end();
    },
  };
}
