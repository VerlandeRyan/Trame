import { Router } from 'express';
import type { RateLimitSettings } from '../middleware/rate-limit.js';
import type { AuthService } from '../services/auth.service.js';
import type { GenreService } from '../services/genre.service.js';
import type { LibraryService } from '../services/library.service.js';
import type { ProfileService } from '../services/profile.service.js';
import type { WorkService } from '../services/work.service.js';
import { createAuthRouter } from './auth.routes.js';
import { createGenreRouter } from './genre.routes.js';
import { createLibraryRouter, createMyLibraryRouter } from './library.routes.js';
import { createMyProfileRouter, createProfileRouter } from './profile.routes.js';
import { createWorkRouter } from './work.routes.js';

export interface ApiServices {
  authService: AuthService;
  genreService: GenreService;
  libraryService: LibraryService;
  profileService: ProfileService;
  workService: WorkService;
  webOrigin: string;
  secureCookies: boolean;
  authRateLimit: RateLimitSettings;
  libraryRateLimit: RateLimitSettings;
}

/** Routes versionnées, montées sous `/api/v1`. Les routes métier s'ajoutent ici. */
export function createApiRouter({
  authService,
  genreService,
  libraryService,
  profileService,
  workService,
  webOrigin,
  secureCookies,
  authRateLimit,
  libraryRateLimit,
}: ApiServices): Router {
  const router = Router();
  router.use(
    '/auth',
    createAuthRouter(authService, { webOrigin, secureCookies, rateLimit: authRateLimit }),
  );
  router.use('/genres', createGenreRouter(genreService));
  router.use('/me', createMyLibraryRouter(libraryService));
  router.use('/me', createMyProfileRouter(profileService, { rateLimit: libraryRateLimit }));
  router.use('/users', createProfileRouter(profileService));
  router.use('/works', createLibraryRouter(libraryService, { rateLimit: libraryRateLimit }));
  router.use('/works', createWorkRouter(workService));
  return router;
}
