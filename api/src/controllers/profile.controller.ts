import type { RequestHandler } from 'express';
import type { ProfileVisibility } from '../db/database.js';
import type { ListEntriesInput } from '../services/library.service.js';
import type { ProfileService } from '../services/profile.service.js';

export function createProfileController(service: ProfileService): {
  get: RequestHandler;
  listEntries: RequestHandler;
  setVisibility: RequestHandler;
} {
  return {
    async get(req, res) {
      const { handle } = req.params as unknown as { handle: string };
      const { lang } = req.query as unknown as { lang?: string };
      res.json(await service.get(handle, req.user, lang));
    },

    async listEntries(req, res) {
      const { handle } = req.params as unknown as { handle: string };
      const input = req.query as unknown as ListEntriesInput;
      res.json(await service.listEntries(handle, req.user, input));
    },

    async setVisibility(req, res) {
      const { visibility } = req.body as { visibility: ProfileVisibility };
      await service.setVisibility(req.user!.id, visibility);
      res.json({ visibility });
    },
  };
}
