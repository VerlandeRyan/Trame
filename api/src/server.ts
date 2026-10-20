import { startServer } from './bootstrap.js';
import { loadConfig } from './config.js';
import { createGoogleClient } from './services/google-identity.js';

const config = loadConfig();
if (config.NODE_ENV === 'production' && !config.GOOGLE) {
  console.warn('Connexion Google non configurée : /api/v1/auth/google répondra AUTH_UNAVAILABLE.');
}
await startServer(config, config.GOOGLE && createGoogleClient(config.GOOGLE));
