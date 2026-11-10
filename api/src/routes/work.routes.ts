/** Public catalogue routes: search, facets, home lists and work details. */
import { Router } from 'express';
import { createWorkController } from '../controllers/work.controller.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { facetsQuery, listWorksQuery, workQuery } from '../schemas/work.js';
import type { WorkService } from '../services/work.service.js';

/** Builds the catalogue router. */
export function createWorkRouter(service: WorkService): Router {
  const router = Router();
  const controller = createWorkController(service);
  router.get('/', validate('query', listWorksQuery), controller.list);
  // Before `/:id`, otherwise "facets" would be read as an identifier.
  router.get('/facets', validate('query', facetsQuery), controller.facets);
  router.get('/featured', validate('query', workQuery), controller.listFeaturedWorks);
  router.get('/top-rated', validate('query', workQuery), controller.listTopRatedWorks);
  router.get('/:id', validate('params', idParams), validate('query', workQuery), controller.get);
  return router;
}
