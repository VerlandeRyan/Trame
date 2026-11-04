import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createLibraryController } from '../controllers/library.controller.js';
import { requireUser } from '../middleware/auth.js';
import { rateLimitOptions, type RateLimitSettings } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { entryBody, listEntriesQuery } from '../schemas/library.js';
import type { LibraryService } from '../services/library.service.js';

/** Monté sous `/me` : la liste de lecture de l'utilisateur connecté. */
export function createMyLibraryRouter(service: LibraryService): Router {
  const controller = createLibraryController(service);
  const router = Router();
  router.get('/entries', requireUser, validate('query', listEntriesQuery), controller.list);
  return router;
}

/** Monté sous `/works` : le suivi d'une œuvre par l'utilisateur connecté. */
export function createLibraryRouter(
  service: LibraryService,
  options: { rateLimit: RateLimitSettings },
): Router {
  const limiter = rateLimit(rateLimitOptions(options.rateLimit));
  const controller = createLibraryController(service);
  const router = Router();
  router.get('/:id/entry', requireUser, validate('params', idParams), controller.get);
  router.put(
    '/:id/entry',
    requireUser,
    limiter,
    validate('params', idParams),
    validate('body', entryBody),
    controller.save,
  );
  router.delete(
    '/:id/entry',
    requireUser,
    limiter,
    validate('params', idParams),
    controller.remove,
  );
  return router;
}
