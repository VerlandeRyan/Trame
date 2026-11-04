import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createProfileController } from '../controllers/profile.controller.js';
import { requireUser } from '../middleware/auth.js';
import { rateLimitOptions, type RateLimitSettings } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import { listEntriesQuery } from '../schemas/library.js';
import { profileParams, profileQuery, visibilityBody } from '../schemas/profile.js';
import type { ProfileService } from '../services/profile.service.js';

/** Monté sous `/users` : profil public d'un membre et sa liste de lecture. */
export function createProfileRouter(service: ProfileService): Router {
  const controller = createProfileController(service);
  const router = Router();
  router.get(
    '/:handle',
    validate('params', profileParams),
    validate('query', profileQuery),
    controller.get,
  );
  router.get(
    '/:handle/entries',
    validate('params', profileParams),
    validate('query', listEntriesQuery),
    controller.listEntries,
  );
  return router;
}

/** Monté sous `/me` : réglage du profil de l'utilisateur connecté. */
export function createMyProfileRouter(
  service: ProfileService,
  options: { rateLimit: RateLimitSettings },
): Router {
  const limiter = rateLimit(rateLimitOptions(options.rateLimit));
  const controller = createProfileController(service);
  const router = Router();
  router.patch(
    '/profile',
    requireUser,
    limiter,
    validate('body', visibilityBody),
    controller.setVisibility,
  );
  return router;
}
