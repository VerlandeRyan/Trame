import type { Request, RequestHandler } from 'express';
import type { EntryInput, LibraryService } from '../services/library.service.js';

/** `requireUser` a déjà écarté les visiteurs ; `workId` est validé par la route. */
function target(req: Request): { userId: number; workId: number } {
  const { id } = req.params as unknown as { id: number };
  return { userId: req.user!.id, workId: id };
}

export function createLibraryController(service: LibraryService): {
  get: RequestHandler;
  save: RequestHandler;
  remove: RequestHandler;
} {
  return {
    async get(req, res) {
      const { userId, workId } = target(req);
      res.json({ entry: await service.getEntry(userId, workId) });
    },

    async save(req, res) {
      const { userId, workId } = target(req);
      const entry = await service.saveEntry(userId, workId, req.body as EntryInput);
      res.json({ entry });
    },

    async remove(req, res) {
      const { userId, workId } = target(req);
      await service.removeEntry(userId, workId);
      res.status(204).end();
    },
  };
}
