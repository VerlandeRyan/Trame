// Point d'entrée des E2E, exclu du build de production.
import { startServer } from './bootstrap.js';
import { loadConfig } from './config.js';
import { createFakeGoogleClient } from './e2e/fake-google.js';

// Les parcours se connectent bien plus souvent que la limite réelle ne le permet.
const E2E_RATE_LIMIT = { windowMs: 10 * 60 * 1000, limit: 10_000 };

const config = loadConfig();
if (config.GOOGLE) throw new Error('server.e2e : refusé avec un client Google configuré.');
await startServer(
  config,
  createFakeGoogleClient(`${config.WEB_ORIGIN}/api/v1/auth/google/callback`),
  E2E_RATE_LIMIT,
);
