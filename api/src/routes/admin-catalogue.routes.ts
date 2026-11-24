/** Routes of the catalogue administration (people, publishers, works), restricted to administrators. */
import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { z } from 'zod';
import {
  createAdminResourceController,
  type AdminResourceController,
} from '../controllers/admin-resource.controller.js';
import { createDraftCountsController } from '../controllers/admin-draft-counts.controller.js';
import { requireAdmin } from '../middleware/auth.js';
import { rateLimitOptions, type RateLimitSettings } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import {
  adminListQuery,
  adminWorkListQuery,
  namesakesQuery,
  personBody,
  personUpdateBody,
  publisherBody,
  publisherUpdateBody,
  workBody,
  workUpdateBody,
} from '../schemas/admin-catalogue.js';
import { idParams } from '../schemas/common.js';
import type { AdminWorkService } from '../services/admin-work.service.js';
import type { AdminPersonService } from '../services/admin-person.service.js';
import type { AdminPublisherService } from '../services/admin-publisher.service.js';

/** The three administration services the router needs. */
export interface AdminCatalogueServices {
  people: AdminPersonService;
  publishers: AdminPublisherService;
  works: AdminWorkService;
}

/** Registers list, read, create, replace (which also publishes a draft), archive, restore and delete routes for one resource. */
function addResourceRoutes(
  router: Router,
  base: string,
  controller: AdminResourceController,
  schemas: { createBody: z.ZodType; updateBody: z.ZodType; listQuery: z.ZodType },
  limiter: RequestHandler,
): void {
  const { createBody, updateBody, listQuery } = schemas;
  const item = `${base}/:id`;
  // Before `item`: `namesakes` is not an identifier.
  router.get(`${base}/namesakes`, validate('query', namesakesQuery), controller.namesakes);
  router.get(base, validate('query', listQuery), controller.list);
  router.get(item, validate('params', idParams), controller.get);
  router.post(base, limiter, validate('body', createBody), controller.create);
  router.put(
    item,
    limiter,
    validate('params', idParams),
    validate('body', updateBody),
    controller.update,
  );
  router.post(`${item}/archive`, limiter, validate('params', idParams), controller.archive);
  router.post(`${item}/restore`, limiter, validate('params', idParams), controller.restore);
  router.delete(item, limiter, validate('params', idParams), controller.delete);
}

/** Builds the administration router, mounted under the admin prefix. */
export function createAdminCatalogueRouter(
  { people, publishers, works }: AdminCatalogueServices,
  options: { rateLimit: RateLimitSettings },
): Router {
  const limiter = rateLimit(rateLimitOptions(options.rateLimit));
  const router = Router();
  router.use(requireAdmin);
  router.get('/draft-counts', createDraftCountsController({ works, people, publishers }));
  const person = {
    createBody: personBody,
    updateBody: personUpdateBody,
    listQuery: adminListQuery,
  };
  const publisher = {
    createBody: publisherBody,
    updateBody: publisherUpdateBody,
    listQuery: adminListQuery,
  };
  const work = {
    createBody: workBody,
    updateBody: workUpdateBody,
    listQuery: adminWorkListQuery,
  };
  addResourceRoutes(
    router,
    '/people',
    createAdminResourceController(people, person),
    person,
    limiter,
  );
  addResourceRoutes(
    router,
    '/publishers',
    createAdminResourceController(publishers, publisher),
    publisher,
    limiter,
  );
  addResourceRoutes(router, '/works', createAdminResourceController(works, work), work, limiter);
  return router;
}
