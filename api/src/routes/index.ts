import { Router } from 'express';
import type { GenreService } from '../services/genre.service.js';
import type { WorkService } from '../services/work.service.js';
import { createGenreRouter } from './genre.routes.js';
import { createWorkRouter } from './work.routes.js';

export interface ApiServices {
  genreService: GenreService;
  workService: WorkService;
}

/** Routes versionnées, montées sous `/api/v1`. Les routes métier s'ajoutent ici. */
export function createApiRouter({ genreService, workService }: ApiServices): Router {
  const router = Router();
  router.use('/genres', createGenreRouter(genreService));
  router.use('/works', createWorkRouter(workService));
  return router;
}
