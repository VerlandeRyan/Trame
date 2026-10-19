import { AppError } from '../errors.js';
import { isHandleAllowed } from '../handle-rules.js';
import type { AuthUser, UserRepository } from '../repositories/user.repository.js';
import type {
  GoogleClient,
  GoogleIdentity,
  GoogleLogin,
  GoogleSecrets,
} from './google-identity.js';

/** Durée pendant laquelle une identité Google attend le choix du handle. */
export const PENDING_SIGNUP_TTL_MS = 10 * 60 * 1000;

/** Réponse de `GET /auth/me` ; `pending` : identité validée, handle à choisir. */
export type AuthStatus =
  { status: 'anonymous' } | { status: 'pending' } | { status: 'authenticated'; user: AuthUser };

/** Retour de Google : compte connu, ou nouvelle identité qui doit encore choisir son handle. */
export type LoginOutcome =
  { kind: 'existing'; user: AuthUser } | { kind: 'new'; identity: GoogleIdentity };

export interface AuthService {
  startLogin(): Promise<GoogleLogin>;
  finishLogin(code: string, secrets: GoogleSecrets): Promise<LoginOutcome>;
  createAccount(identity: GoogleIdentity, handle: string): Promise<AuthUser>;
  findUser(id: number): Promise<AuthUser | null>;
}

export function createAuthService(deps: {
  users: UserRepository;
  google: GoogleClient;
}): AuthService {
  const { users, google } = deps;

  async function activeAccount(sub: string): Promise<AuthUser | null> {
    const account = await users.findByGoogleSub(sub);
    if (account?.deleted) throw new AppError('UNAUTHENTICATED');
    return account?.user ?? null;
  }

  return {
    startLogin: () => google.start(),

    async finishLogin(code, secrets) {
      const identity = await google.verify(code, secrets);
      const user = await activeAccount(identity.sub);
      return user ? { kind: 'existing', user } : { kind: 'new', identity };
    },

    async createAccount(identity, handle) {
      if (!isHandleAllowed(handle)) throw new AppError('HANDLE_NOT_ALLOWED');
      const result = await users.create({
        googleSub: identity.sub,
        email: identity.email,
        handle,
      });
      switch (result.status) {
        case 'created':
          return result.user;
        case 'handle_taken':
          throw new AppError('HANDLE_TAKEN');
        case 'handle_rejected':
          throw new AppError('HANDLE_NOT_ALLOWED');
        case 'already_registered': {
          const user = await activeAccount(identity.sub);
          if (!user) throw new AppError('UNAUTHENTICATED');
          return user;
        }
      }
    },

    findUser: (id) => users.findById(id),
  };
}
