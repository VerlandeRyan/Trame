import { Router } from 'express';
import type { AuthService } from '../services/auth.service.js';
import type { GenreService } from '../services/genre.service.js';
import type { WorkService } from '../services/work.service.js';
import { createAuthRouter } from './auth.routes.js';
import { createGenreRouter } from './genre.routes.js';
import { createWorkRouter } from './work.routes.js';

export interface ApiServices {
  authService: AuthService;
  genreService: GenreService;
  workService: WorkService;
  webOrigin: string;
  secureCookies: boolean;
}

/** Routes versionnées, montées sous `/api/v1`. Les routes métier s'ajoutent ici. */
export function createApiRouter({
  authService,
  genreService,
  workService,
  webOrigin,
  secureCookies,
}: ApiServices): Router {
  const router = Router();
  router.use('/auth', createAuthRouter(authService, { webOrigin, secureCookies }));
  router.use('/genres', createGenreRouter(genreService));
  router.use('/works', createWorkRouter(workService));
  return router;
}
