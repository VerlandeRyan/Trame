import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { currentUser } from '../middleware/auth.js';
import { validated } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import type { AdminListInput, Page } from '../services/admin-list.js';

/** Ce que le contrôleur attend d'un service du catalogue (œuvres, personnes, éditeurs). */
export interface AdminResourceService<Item, Full, Input, ListInput extends AdminListInput> {
  list(input: ListInput): Promise<Page<Item>>;
  get(id: number): Promise<Full>;
  create(input: Input): Promise<Full>;
  update(id: number, input: Input): Promise<Full>;
  archive(id: number, adminId: number): Promise<Full>;
  restore(id: number, adminId: number): Promise<Full>;
}

export interface AdminResourceController {
  list: RequestHandler;
  get: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  archive: RequestHandler;
  restore: RequestHandler;
}

/** Les routes ont déjà validé la requête avec `listQuery`, `idParams` et `body`. */
export function createAdminResourceController<Item, Full, Input, ListInput extends AdminListInput>(
  service: AdminResourceService<Item, Full, Input, ListInput>,
  body: z.ZodType<Input>,
  listQuery: z.ZodType<ListInput>,
): AdminResourceController {
  return {
    async list(req, res) {
      res.json(await service.list(validated(listQuery, req.query)));
    },

    async get(req, res) {
      res.json(await service.get(validated(idParams, req.params).id));
    },

    async create(req, res) {
      res.status(201).json(await service.create(validated(body, req.body)));
    },

    async update(req, res) {
      const { id } = validated(idParams, req.params);
      res.json(await service.update(id, validated(body, req.body)));
    },

    async archive(req, res) {
      const { id } = validated(idParams, req.params);
      res.json(await service.archive(id, currentUser(req).id));
    },

    async restore(req, res) {
      const { id } = validated(idParams, req.params);
      res.json(await service.restore(id, currentUser(req).id));
    },
  };
}
