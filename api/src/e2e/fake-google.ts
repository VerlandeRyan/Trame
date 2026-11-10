/** Fake Google client used by the end-to-end tests, so no network call is made. */
import { AppError } from '../errors.js';
import type { GoogleClient } from '../services/google-identity.js';

/** The `code` of a fake sign-in has the form `e2e:<sub>:<email>`. */
export const FAKE_CODE_PREFIX = 'e2e:';

/**
 * Replaces Google in the E2E tests; the callback, session and cookie are the API's own.
 * `start()` provides a fresh identity; a test imposes one by calling the callback with its own `code`.
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
