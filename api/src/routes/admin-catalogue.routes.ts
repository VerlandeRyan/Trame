/** Routes of the catalogue administration (people, publishers, works), restricted to administrators. */
import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { z } from 'zod';
import {
  createAdminResourceController,
  type AdminResourceController,
} from '../controllers/admin-resource.controller.js';
import { requireAdmin } from '../middleware/auth.js';
import { rateLimitOptions, type RateLimitSettings } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import {
  adminListQuery,
  adminWorkListQuery,
  personBody,
  publisherBody,
  workBody,
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

/** Registers list, read, create, replace, archive and restore routes for one resource. */
function addResourceRoutes(
  router: Router,
  base: string,
  controller: AdminResourceController,
  schemas: { body: z.ZodType; listQuery: z.ZodType },
  limiter: RequestHandler,
): void {
  const { body, listQuery } = schemas;
  const item = `${base}/:id`;
  router.get(base, validate('query', listQuery), controller.list);
  router.get(item, validate('params', idParams), controller.get);
  router.post(base, limiter, validate('body', body), controller.create);
  router.put(
    item,
    limiter,
    validate('params', idParams),
    validate('body', body),
    controller.update,
  );
  router.post(`${item}/archive`, limiter, validate('params', idParams), controller.archive);
  router.post(`${item}/restore`, limiter, validate('params', idParams), controller.restore);
}

/** Builds the administration router, mounted under the admin prefix. */
export function createAdminCatalogueRouter(
  { people, publishers, works }: AdminCatalogueServices,
  options: { rateLimit: RateLimitSettings },
): Router {
  const limiter = rateLimit(rateLimitOptions(options.rateLimit));
  const router = Router();
  router.use(requireAdmin);
  const person = { body: personBody, listQuery: adminListQuery };
  const publisher = { body: publisherBody, listQuery: adminListQuery };
  const work = { body: workBody, listQuery: adminWorkListQuery };
  addResourceRoutes(
    router,
    '/people',
    createAdminResourceController(people, person.body, person.listQuery),
    person,
    limiter,
  );
  addResourceRoutes(
    router,
    '/publishers',
    createAdminResourceController(publishers, publisher.body, publisher.listQuery),
    publisher,
    limiter,
  );
  addResourceRoutes(
    router,
    '/works',
    createAdminResourceController(works, work.body, work.listQuery),
    work,
    limiter,
  );
  return router;
}
