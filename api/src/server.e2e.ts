/** Entry point of the end-to-end tests (fake Google client, relaxed rate limit); excluded from the production build. */
import { startServer } from './bootstrap.js';
import { loadConfig } from './config.js';
import { createFakeGoogleClient } from './e2e/fake-google.js';

// The journeys sign in and write to their list far more often than the real limits
// allow: a suite run quickly would exceed 120 writes per minute.
const E2E_RATE_LIMIT = { windowMs: 10 * 60 * 1000, limit: 10_000 };

const config = loadConfig();
if (config.GOOGLE) throw new Error('server.e2e : refusé avec un client Google configuré.');
await startServer(
  config,
  createFakeGoogleClient(`${config.WEB_ORIGIN}/api/v1/auth/google/callback`),
  E2E_RATE_LIMIT,
);
