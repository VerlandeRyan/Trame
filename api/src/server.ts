import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/database.js';
import { createSessionRepository } from './repositories/session.repository.js';
import { createGoogleClient } from './services/google-identity.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
// Import dynamique : Scalar n'est chargé qu'hors production (le conteneur local passe `NODE_ENV`).
const docs =
  process.env.NODE_ENV === 'production'
    ? undefined
    : (await import('@scalar/express-api-reference')).apiReference({
        url: '/api/v1/openapi.json',
      });
if (config.NODE_ENV === 'production' && !config.GOOGLE) {
  console.warn('Connexion Google non configurée : /api/v1/auth/google répondra AUTH_UNAVAILABLE.');
}
const app = createApp({
  db,
  docs,
  trustProxy: config.TRUST_PROXY,
  auth: {
    google: config.GOOGLE && createGoogleClient(config.GOOGLE),
    sessionSecret: config.SESSION_SECRET,
    webOrigin: config.WEB_ORIGIN,
    secureCookies: config.SECURE_COOKIES,
  },
});
const server = app.listen(config.PORT, () => {
  console.log(`API à l'écoute sur le port ${config.PORT}`);
});

// Purge des sessions expirées (au démarrage puis toutes les 15 minutes).
const sessions = createSessionRepository(db);
const PRUNE_INTERVAL_MS = 15 * 60 * 1000;
const prune = () => {
  sessions.removeExpired().catch((err: unknown) => console.error(err));
};
prune();
const pruneTimer = setInterval(prune, PRUNE_INTERVAL_MS);
pruneTimer.unref();

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function shutdown(): Promise<void> {
  try {
    await closeServer();
    await db.destroy();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
