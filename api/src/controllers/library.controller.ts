/** HTTP controller of the signed-in user's reading list. */
import type { Request, RequestHandler } from 'express';
import { currentUser } from '../middleware/auth.js';
import { validated } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { entryBody, listEntriesQuery } from '../schemas/library.js';
import type { LibraryService } from '../services/library.service.js';

/** Reads the user and work ids of a request; the route has already checked the user and validated the id. */
function target(req: Request): { userId: number; workId: number } {
  const { id } = validated(idParams, req.params);
  return { userId: currentUser(req).id, workId: id };
}

/** Builds the reading-list request handlers. */
export function createLibraryController(service: LibraryService): {
  get: RequestHandler;
  save: RequestHandler;
  remove: RequestHandler;
  list: RequestHandler;
} {
  return {
    async list(req, res) {
      const input = validated(listEntriesQuery, req.query);
      res.json(await service.listEntries(currentUser(req).id, input));
    },

    async get(req, res) {
      const { userId, workId } = target(req);
      res.json({ entry: await service.getEntry(userId, workId) });
    },

    async save(req, res) {
      const { userId, workId } = target(req);
      const entry = await service.saveEntry(userId, workId, validated(entryBody, req.body));
      res.json({ entry });
    },

    async remove(req, res) {
      const { userId, workId } = target(req);
      await service.removeEntry(userId, workId);
      res.status(204).end();
    },
  };
}
