import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { AppError } from '../errors.js';

/** Identité vérifiée par Google : seuls ces deux champs sont conservés. */
export interface GoogleIdentity {
  sub: string;
  email: string;
}

/** Secrets d'une connexion en cours, gardés en session jusqu'au retour de Google. */
export interface GoogleSecrets {
  codeVerifier: string;
  nonce: string;
}

export interface GoogleLogin extends GoogleSecrets {
  url: string;
  state: string;
}

/** Seule porte vers Google : remplacée par une doublure dans les tests. */
export interface GoogleClient {
  start(): Promise<GoogleLogin>;
  /** Échange le code contre l'identité ; lève `AUTH_STATE_INVALID` si Google la refuse. */
  verify(code: string, secrets: GoogleSecrets): Promise<GoogleIdentity>;
}

export interface GoogleSettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export type GoogleOAuth = Pick<
  OAuth2Client,
  'generateAuthUrl' | 'generateCodeVerifierAsync' | 'getToken' | 'verifyIdToken'
>;

/** Client OAuth Google (code d'autorisation + PKCE + nonce, périmètre `openid email`). */
export function createGoogleClient(
  settings: GoogleSettings,
  oauth: GoogleOAuth = new OAuth2Client(
    settings.clientId,
    settings.clientSecret,
    settings.redirectUri,
  ),
): GoogleClient {
  return {
    async start() {
      const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync();
      const state = crypto.randomUUID();
      const nonce = crypto.randomUUID();
      const url = oauth.generateAuthUrl({
        scope: ['openid', 'email'],
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
        prompt: 'select_account',
      });
      return { url, state, nonce, codeVerifier };
    },

    async verify(code, { codeVerifier, nonce }) {
      try {
        const { tokens } = await oauth.getToken({ code, codeVerifier });
        if (!tokens.id_token) throw new Error('missing id_token');
        const ticket = await oauth.verifyIdToken({
          idToken: tokens.id_token,
          audience: settings.clientId,
        });
        const payload = ticket.getPayload();
        if (
          payload?.sub &&
          payload.email &&
          payload.email_verified === true &&
          payload.nonce === nonce
        ) {
          return { sub: payload.sub, email: payload.email };
        }
        throw new Error('invalid identity');
      } catch {
        throw new AppError('AUTH_STATE_INVALID');
      }
    },
  };
}

/** Client utilisé quand Google n'est pas configuré : toute tentative répond `AUTH_UNAVAILABLE`. */
export const unavailableGoogleClient: GoogleClient = {
  start() {
    return Promise.reject(new AppError('AUTH_UNAVAILABLE'));
  },
  verify() {
    return Promise.reject(new AppError('AUTH_UNAVAILABLE'));
  },
};
