/** Builds the Express application: middleware, routes and the services wired to the database. */
import { randomBytes } from 'node:crypto';
import express, { type Express, type RequestHandler } from 'express';
import type { Db } from './db/database.js';
import { attachUser, checkOrigin } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import {
  ADMIN_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  LIBRARY_RATE_LIMIT,
  type RateLimitSettings,
} from './middleware/rate-limit.js';
import { buildOpenApiDocument } from './openapi/document.js';
import { createAdminWorkRepository } from './repositories/admin-work.repository.js';
import { createHealthRepository } from './repositories/health.repository.js';
import { createAdminPersonRepository } from './repositories/admin-person.repository.js';
import { createAdminPublisherRepository } from './repositories/admin-publisher.repository.js';
import { createGenreRepository } from './repositories/genre.repository.js';
import { createLibraryRepository } from './repositories/library.repository.js';
import { createProfileRepository } from './repositories/profile.repository.js';
import { createWorkRepository } from './repositories/work.repository.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createApiRouter } from './routes/index.js';
import { createSessionRepository } from './repositories/session.repository.js';
import { createUserRepository } from './repositories/user.repository.js';
import { createAdminWorkService } from './services/admin-work.service.js';
import { createAuthService } from './services/auth.service.js';
import { createAdminPersonService } from './services/admin-person.service.js';
import { createAdminPublisherService } from './services/admin-publisher.service.js';
import { unavailableGoogleClient, type GoogleClient } from './services/google-identity.js';
import { createSessionMiddleware } from './session/middleware.js';
import { SessionStore } from './session/store.js';
import { createGenreService } from './services/genre.service.js';
import { createHealthService } from './services/health.service.js';
import { createLibraryService } from './services/library.service.js';
import { createProfileService } from './services/profile.service.js';
import { createWorkService } from './services/work.service.js';

/**
 * Authentication settings, all optional: without them Google sign-in answers `AUTH_UNAVAILABLE`
 * and the session secret is random (local to the process).
 */
export interface AuthOptions {
  google?: GoogleClient;
  sessionSecret?: string;
  webOrigin?: string;
  secureCookies?: boolean;
  /** Rate limit of the sign-in routes. */
  rateLimit?: RateLimitSettings;
}

/**
 * Creates the application. `docs` is the API reference UI, provided outside production only
 * (see `bootstrap.ts`).
 */
export function createApp({
  db,
  docs,
  auth = {},
  trustProxy = 0,
  libraryRateLimit = LIBRARY_RATE_LIMIT,
  adminRateLimit = ADMIN_RATE_LIMIT,
}: {
  db: Db;
  docs?: RequestHandler<never, string>;
  auth?: AuthOptions;
  trustProxy?: number;
  /** Rate limit of reading-list writes (raised by the E2E tests). */
  libraryRateLimit?: RateLimitSettings;
  /** Rate limit of catalogue administration writes. */
  adminRateLimit?: RateLimitSettings;
}): Express {
  const {
    google = unavailableGoogleClient,
    sessionSecret = randomBytes(32).toString('hex'),
    webOrigin = 'http://localhost:3001',
    secureCookies = false,
    rateLimit = AUTH_RATE_LIMIT,
  } = auth;
  const authService = createAuthService({ users: createUserRepository(db), google });
  const libraryService = createLibraryService(createLibraryRepository(db));

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

  // Unversioned health probe, used by the orchestration.
  app.use('/health', createHealthRouter(createHealthService(createHealthRepository(db))));
  app.use(
    '/api/v1',
    createApiRouter({
      authService,
      webOrigin,
      secureCookies,
      authRateLimit: rateLimit,
      libraryRateLimit,
      adminRateLimit,
      adminCatalogue: {
        people: createAdminPersonService(createAdminPersonRepository(db)),
        publishers: createAdminPublisherService(createAdminPublisherRepository(db)),
        works: createAdminWorkService(createAdminWorkRepository(db)),
      },
      libraryService,
      profileService: createProfileService({
        profiles: createProfileRepository(db),
        library: libraryService,
      }),
      genreService: createGenreService(createGenreRepository(db)),
      workService: createWorkService(createWorkRepository(db)),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
