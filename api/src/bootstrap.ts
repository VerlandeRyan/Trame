import { createApp } from './app.js';
import type { Config } from './config.js';
import { createDb } from './db/database.js';
import type { RateLimitSettings } from './middleware/rate-limit.js';
import { createSessionRepository } from './repositories/session.repository.js';
import type { GoogleClient } from './services/google-identity.js';

const PRUNE_INTERVAL_MS = 15 * 60 * 1000;

/** Démarre l'API ; seuls le client Google et la limite de débit changent selon le point d'entrée. */
export async function startServer(
  config: Config,
  google: GoogleClient | undefined,
  rateLimit?: RateLimitSettings,
): Promise<void> {
  const db = createDb(config.DATABASE_URL);
  // Scalar (documentation) n'est chargé qu'hors production.
  const docs =
    process.env.NODE_ENV === 'production'
      ? undefined
      : (await import('@scalar/express-api-reference')).apiReference({
          url: '/api/v1/openapi.json',
        });
  const app = createApp({
    db,
    docs,
    trustProxy: config.TRUST_PROXY,
    libraryRateLimit: rateLimit,
    auth: {
      google,
      sessionSecret: config.SESSION_SECRET,
      webOrigin: config.WEB_ORIGIN,
      secureCookies: config.SECURE_COOKIES,
      rateLimit,
    },
  });
  const server = app.listen(config.PORT, () => {
    console.log(`API à l'écoute sur le port ${config.PORT}`);
  });

  // Purge des sessions expirées (au démarrage puis toutes les 15 minutes).
  const sessions = createSessionRepository(db);
  const prune = () => {
    sessions.removeExpired().catch((err: unknown) => console.error(err));
  };
  prune();
  setInterval(prune, PRUNE_INTERVAL_MS).unref();

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
}
