import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { PROFILE_VISIBILITIES } from '../db/database.js';
import { createProfileController } from '../controllers/profile.controller.js';
import { handleSchema } from '../handle-rules.js';
import { requireUser } from '../middleware/auth.js';
import { rateLimitOptions, type RateLimitSettings } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import type { ProfileService } from '../services/profile.service.js';
import { listEntriesQuery } from './library.routes.js';
import { lang } from './work.routes.js';

export const profileParams = z.object({
  handle: handleSchema.describe('Pseudo public du membre, sans tenir compte de la casse.'),
});

export const profileQuery = z.object({ lang: lang.optional() });

export const visibilityBody = z.strictObject({
  visibility: z
    .enum(PROFILE_VISIBILITIES)
    .describe('`public` par défaut ; `private` masque tout sauf le pseudo.'),
});

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
