import { AppError } from '../errors.js';
import type { GoogleClient } from '../services/google-identity.js';

/** Le `code` d'une fausse connexion a la forme `e2e:<sub>:<e-mail>`. */
export const FAKE_CODE_PREFIX = 'e2e:';

/**
 * Remplace Google dans les E2E (voir `server.e2e.ts`) ; le callback, la session et le cookie sont
 * ceux de l'API. `start()` fournit une identité neuve ; un test en impose une en appelant le
 * callback avec son propre `code`.
 */
export function createFakeGoogleClient(callbackUrl: string): GoogleClient {
  return {
    start() {
      const state = crypto.randomUUID();
      const identity = crypto.randomUUID();
      const code = `${FAKE_CODE_PREFIX}${identity}:${identity}@example.test`;
      const url = `${callbackUrl}?code=${encodeURIComponent(code)}&state=${state}`;
      return Promise.resolve({ url, state, nonce: 'e2e', codeVerifier: 'e2e' });
    },

    verify(code) {
      const [sub, email] = code.slice(FAKE_CODE_PREFIX.length).split(':');
      if (!code.startsWith(FAKE_CODE_PREFIX) || !sub || !email) {
        return Promise.reject(new AppError('AUTH_STATE_INVALID'));
      }
      return Promise.resolve({ sub, email });
    },
  };
}
