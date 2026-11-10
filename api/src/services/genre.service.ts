/** Service listing the genres. */
import type { GenreRecord, GenreRepository } from '../repositories/genre.repository.js';

/** Response of the genre list. */
export interface GenreList {
  items: GenreRecord[];
}

/** Genre operations. */
export interface GenreService {
  list(): Promise<GenreList>;
}

/** Creates the genre service. */
export function createGenreService(repository: GenreRepository): GenreService {
  return {
    async list() {
      return { items: await repository.list() };
    },
  };
}
