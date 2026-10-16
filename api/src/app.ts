import express, { type Express, type RequestHandler } from 'express';
import type { Db } from './db/database.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { buildOpenApiDocument } from './openapi/document.js';
import { createHealthRepository } from './repositories/health.repository.js';
import { createGenreRepository } from './repositories/genre.repository.js';
import { createWorkRepository } from './repositories/work.repository.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createApiRouter } from './routes/index.js';
import { createGenreService } from './services/genre.service.js';
import { createHealthService } from './services/health.service.js';
import { createWorkService } from './services/work.service.js';

/**
 * `docs` : interface de lecture de la spécification, montée sur `/docs` ; fournie seulement hors
 * production (voir `server.ts`).
 */
export function createApp({ db, docs }: { db: Db; docs?: RequestHandler<never, string> }): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

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
      genreService: createGenreService(createGenreRepository(db)),
      workService: createWorkService(createWorkRepository(db)),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
