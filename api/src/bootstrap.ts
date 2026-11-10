/** Starts the HTTP server: database, application, session cleanup and graceful shutdown. */
import { createApp } from './app.js';
import type { Config } from './config.js';
import { createDb } from './db/database.js';
import type { RateLimitSettings } from './middleware/rate-limit.js';
import { createSessionRepository } from './repositories/session.repository.js';
import type { GoogleClient } from './services/google-identity.js';

/** Delay between two purges of expired sessions. */
const PRUNE_INTERVAL_MS = 15 * 60 * 1000;

/** Starts the API; only the Google client and the rate limit differ between entry points. */
export async function startServer(
  config: Config,
  google: GoogleClient | undefined,
  rateLimit?: RateLimitSettings,
): Promise<void> {
  const db = createDb(config.DATABASE_URL);
  // The API reference UI is only loaded outside production.
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

  // Purge expired sessions at startup, then every 15 minutes.
  const sessions = createSessionRepository(db);
  /** Removes the expired sessions, logging any failure. */
  const prune = () => {
    sessions.removeExpired().catch((err: unknown) => console.error(err));
  };
  prune();
  setInterval(prune, PRUNE_INTERVAL_MS).unref();

  /** Stops accepting connections and resolves once the server is closed. */
  function closeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  /** Closes the server and the database, then exits the process. */
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
