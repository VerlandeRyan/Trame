import { Router } from 'express';
import { createGenreController } from '../controllers/genre.controller.js';
import type { GenreService } from '../services/genre.service.js';

export function createGenreRouter(service: GenreService): Router {
  const controller = createGenreController(service);
  const router = Router();
  router.get('/', controller.list);
  return router;
}
