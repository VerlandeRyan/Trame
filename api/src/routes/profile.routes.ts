/** Routes of public member profiles and of the signed-in user's profile setting. */
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createProfileController } from '../controllers/profile.controller.js';
import { requireUser } from '../middleware/auth.js';
import { rateLimitOptions, type RateLimitSettings } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import { listEntriesQuery } from '../schemas/library.js';
import { profileParams, profileQuery, visibilityBody } from '../schemas/profile.js';
import type { ProfileService } from '../services/profile.service.js';

/** Mounted under the users prefix: a member's public profile and reading list. */
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

/** Mounted under the current-user prefix: the signed-in user's profile setting. */
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
