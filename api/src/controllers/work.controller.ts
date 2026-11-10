/** HTTP controller of the public catalogue: search, facets, home lists and work details. */
import type { RequestHandler } from 'express';
import { validated } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { facetsQuery, listWorksQuery, workQuery } from '../schemas/work.js';
import type { WorkService } from '../services/work.service.js';

/** Builds the catalogue request handlers. */
export function createWorkController(service: WorkService): {
  list: RequestHandler;
  facets: RequestHandler;
  listFeaturedWorks: RequestHandler;
  listTopRatedWorks: RequestHandler;
  get: RequestHandler;
} {
  return {
    async listFeaturedWorks(req, res) {
      const { lang } = validated(workQuery, req.query);
      res.json(await service.listFeaturedWorks(lang));
    },

    async listTopRatedWorks(req, res) {
      const { lang } = validated(workQuery, req.query);
      res.json(await service.listTopRatedWorks(lang));
    },

    async list(req, res) {
      res.json(await service.list(validated(listWorksQuery, req.query)));
    },

    async facets(req, res) {
      res.json(await service.facets(validated(facetsQuery, req.query)));
    },

    async get(req, res) {
      const { id } = validated(idParams, req.params);
      const { lang } = validated(workQuery, req.query);
      res.json(await service.get(id, lang));
    },
  };
}
