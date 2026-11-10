/** The only gateway to Google sign-in (OAuth authorisation code with PKCE and nonce). */
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { AppError } from '../errors.js';

/** Identity verified by Google: only these two fields are kept. */
export interface GoogleIdentity {
  sub: string;
  email: string;
}

/** Secrets of a sign-in in progress, kept in the session until Google sends the user back. */
export interface GoogleSecrets {
  codeVerifier: string;
  nonce: string;
}

/** What starting a sign-in produces: the Google URL to visit and the values to remember. */
export interface GoogleLogin extends GoogleSecrets {
  url: string;
  state: string;
}

/** The only gateway to Google: replaced by a stand-in in the tests. */
export interface GoogleClient {
  start(): Promise<GoogleLogin>;
  /** Exchanges the code for the identity; throws `AUTH_STATE_INVALID` if Google rejects it. */
  verify(code: string, secrets: GoogleSecrets): Promise<GoogleIdentity>;
}

/** Google OAuth client settings. */
export interface GoogleSettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** The part of the Google OAuth client the code relies on. */
export type GoogleOAuth = Pick<
  OAuth2Client,
  'generateAuthUrl' | 'generateCodeVerifierAsync' | 'getToken' | 'verifyIdToken'
>;

/** Google OAuth client (authorisation code + PKCE + nonce, `openid email` scope). */
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

/** Client used when Google is not configured: every attempt answers `AUTH_UNAVAILABLE`. */
export const unavailableGoogleClient: GoogleClient = {
  start() {
    return Promise.reject(new AppError('AUTH_UNAVAILABLE'));
  },
  verify() {
    return Promise.reject(new AppError('AUTH_UNAVAILABLE'));
  },
};
