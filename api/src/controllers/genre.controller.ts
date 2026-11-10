/** HTTP controller of the genre list. */
import type { RequestHandler } from 'express';
import type { GenreService } from '../services/genre.service.js';

/** Builds the genre request handlers. */
export function createGenreController(service: GenreService): { list: RequestHandler } {
  return {
    async list(_req, res) {
      res.json(await service.list());
    },
  };
}
