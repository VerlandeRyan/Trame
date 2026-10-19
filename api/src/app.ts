import { randomBytes } from 'node:crypto';
import express, { type Express, type RequestHandler } from 'express';
import type { Db } from './db/database.js';
import { attachUser, checkOrigin } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { buildOpenApiDocument } from './openapi/document.js';
import { createHealthRepository } from './repositories/health.repository.js';
import { createGenreRepository } from './repositories/genre.repository.js';
import { createWorkRepository } from './repositories/work.repository.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createApiRouter } from './routes/index.js';
import { createSessionRepository } from './repositories/session.repository.js';
import { createUserRepository } from './repositories/user.repository.js';
import { createAuthService } from './services/auth.service.js';
import { unavailableGoogleClient, type GoogleClient } from './services/google-identity.js';
import { createSessionMiddleware } from './session/middleware.js';
import { SessionStore } from './session/store.js';
import { createGenreService } from './services/genre.service.js';
import { createHealthService } from './services/health.service.js';
import { createWorkService } from './services/work.service.js';

/**
 * Réglages d'authentification. Tous facultatifs : sans eux, la connexion Google répond
 * `AUTH_UNAVAILABLE` et le secret de session est aléatoire (propre au processus).
 */
export interface AuthOptions {
  google?: GoogleClient;
  sessionSecret?: string;
  webOrigin?: string;
  secureCookies?: boolean;
}

/**
 * `docs` : interface de lecture de la spécification, montée sur `/docs` ; fournie seulement hors
 * production (voir `server.ts`).
 */
export function createApp({
  db,
  docs,
  auth = {},
  trustProxy = 0,
}: {
  db: Db;
  docs?: RequestHandler<never, string>;
  auth?: AuthOptions;
  trustProxy?: number;
}): Express {
  const {
    google = unavailableGoogleClient,
    sessionSecret = randomBytes(32).toString('hex'),
    webOrigin = 'http://localhost:3001',
    secureCookies = false,
  } = auth;
  const authService = createAuthService({ users: createUserRepository(db), google });

  const app = express();
  app.disable('x-powered-by');
  if (trustProxy > 0) app.set('trust proxy', trustProxy);
  app.use(express.json({ limit: '100kb' }));
  app.use(
    createSessionMiddleware({
      store: new SessionStore(createSessionRepository(db)),
      secret: sessionSecret,
      secureCookies,
    }),
  );
  app.use(checkOrigin(webOrigin));
  app.use(attachUser((id) => authService.findUser(id)));

  const openApiDocument = buildOpenApiDocument();
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  if (docs) app.use('/docs', docs);

  // Sonde hors préfixe : non versionnée, utilisée par l'orchestration.
  app.use('/health', createHealthRouter(createHealthService(createHealthRepository(db))));
  app.use(
    '/api/v1',
    createApiRouter({
      authService,
      webOrigin,
      secureCookies,
      genreService: createGenreService(createGenreRepository(db)),
      workService: createWorkService(createWorkRepository(db)),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
