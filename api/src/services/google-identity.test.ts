import { OAuth2Client } from 'google-auth-library';
import { describe, expect, it } from 'vitest';
import { createGoogleClient, type GoogleOAuth } from './google-identity.js';

const settings = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:3000/api/v1/auth/google/callback',
};
const secrets = { codeVerifier: 'verifier', nonce: 'nonce-1' };

/** Google simulé : renvoie le jeton et le contenu donnés, ou échoue. */
function fakeOAuth(options: {
  idToken?: string | null;
  payload?: Record<string, unknown>;
  tokenError?: Error;
}): GoogleOAuth {
  const { idToken = 'id-token', payload, tokenError } = options;
  return {
    getToken: () =>
      tokenError ? Promise.reject(tokenError) : Promise.resolve({ tokens: { id_token: idToken } }),
    verifyIdToken: () => Promise.resolve({ getPayload: () => payload }),
  } as unknown as GoogleOAuth;
}

const goodPayload = {
  sub: 'sub-1',
  email: 'ryan@exemple.test',
  email_verified: true,
  nonce: 'nonce-1',
};

describe('start', () => {
  it('construit l’adresse Google avec PKCE, state et nonce, sans écran de consentement superflu', async () => {
    const client = createGoogleClient(
      settings,
      new OAuth2Client(settings.clientId, settings.clientSecret, settings.redirectUri),
    );
    const login = await client.start();
    const params = new URL(login.url).searchParams;
    expect(new URL(login.url).origin).toBe('https://accounts.google.com');
    expect(params.get('client_id')).toBe(settings.clientId);
    expect(params.get('redirect_uri')).toBe(settings.redirectUri);
    expect(params.get('scope')).toBe('openid email');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBeTruthy();
    expect(params.get('state')).toBe(login.state);
    expect(params.get('nonce')).toBe(login.nonce);
    expect(login.codeVerifier).toBeTruthy();
  });

  it('génère des secrets différents à chaque connexion', async () => {
    const client = createGoogleClient(settings);
    const [a, b] = [await client.start(), await client.start()];
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});

describe('verify', () => {
  it('renvoie seulement sub et e-mail d’un jeton valide', async () => {
    const client = createGoogleClient(
      settings,
      fakeOAuth({ payload: { ...goodPayload, name: 'Ryan' } }),
    );
    expect(await client.verify('code', secrets)).toEqual({
      sub: 'sub-1',
      email: 'ryan@exemple.test',
    });
  });

  it.each([
    ['sans jeton d’identité', fakeOAuth({ idToken: null })],
    ['sans contenu', fakeOAuth({ payload: undefined })],
    [
      'avec un e-mail non vérifié',
      fakeOAuth({ payload: { ...goodPayload, email_verified: false } }),
    ],
    ['sans e-mail', fakeOAuth({ payload: { ...goodPayload, email: undefined } })],
    ['avec un autre nonce', fakeOAuth({ payload: { ...goodPayload, nonce: 'autre' } })],
    ['sans nonce', fakeOAuth({ payload: { ...goodPayload, nonce: undefined } })],
    ['quand Google refuse le code', fakeOAuth({ tokenError: new Error('invalid_grant') })],
  ])('refuse une réponse %s', async (_label, oauth) => {
    const client = createGoogleClient(settings, oauth);
    await expect(client.verify('code', secrets)).rejects.toMatchObject({
      code: 'AUTH_STATE_INVALID',
    });
  });
});
