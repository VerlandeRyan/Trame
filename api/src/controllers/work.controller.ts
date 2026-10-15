import type { RequestHandler } from 'express';
import type { ListWorksInput, WorkFilterInput, WorkService } from '../services/work.service.js';

export function createWorkController(service: WorkService): {
  list: RequestHandler;
  facets: RequestHandler;
  get: RequestHandler;
} {
  return {
    async list(req, res) {
      // Déjà validé et converti par `validate('query', …)` dans la route.
      const input = req.query as unknown as ListWorksInput;
      res.json(await service.list(input));
    },

    async facets(req, res) {
      const input = req.query as unknown as WorkFilterInput;
      res.json(await service.facets(input));
    },

    async get(req, res) {
      const { id } = req.params as unknown as { id: number };
      const { lang } = req.query as unknown as { lang?: string };
      res.json(await service.get(id, lang));
    },
  };
}
