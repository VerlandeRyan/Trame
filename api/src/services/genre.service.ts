import type { GenreRecord, GenreRepository } from '../repositories/genre.repository.js';

export interface GenreList {
  items: GenreRecord[];
}

export interface GenreService {
  list(): Promise<GenreList>;
}

export function createGenreService(repository: GenreRepository): GenreService {
  return {
    async list() {
      return { items: await repository.list() };
    },
  };
}
