import express, { type Express } from 'express';
import type { Db } from './db/database.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createHealthRepository } from './repositories/health.repository.js';
import { createGenreRepository } from './repositories/genre.repository.js';
import { createWorkRepository } from './repositories/work.repository.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createApiRouter } from './routes/index.js';
import { createGenreService } from './services/genre.service.js';
import { createHealthService } from './services/health.service.js';
import { createWorkService } from './services/work.service.js';

export function createApp({ db }: { db: Db }): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

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
