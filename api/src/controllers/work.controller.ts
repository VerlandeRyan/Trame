import type { RequestHandler } from 'express';
import type { ListWorksInput, WorkService } from '../services/work.service.js';

export function createWorkController(service: WorkService): { list: RequestHandler; get: RequestHandler } {
  return {
    async list(req, res) {
      // Déjà validé et converti par `validate('query', …)` dans la route.
      const input = req.query as unknown as ListWorksInput;
      res.json(await service.list(input));
    },

    async get(req, res) {
      const { id } = req.params as unknown as { id: number };
      res.json(await service.get(id));
    },
  };
}
