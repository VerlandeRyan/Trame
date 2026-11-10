/** Read access to the genre table. */
import type { Db, GenreCategory } from '../db/database.js';

/** A genre or format. */
export interface GenreRecord {
  code: string;
  category: GenreCategory;
}

/** Genre queries. */
export interface GenreRepository {
  /** All genres and formats, sorted by category then code. */
  list(): Promise<GenreRecord[]>;
}

/** Creates the genre repository. */
export function createGenreRepository(db: Db): GenreRepository {
  return {
    async list() {
      return db
        .selectFrom('genre')
        .select(['code', 'category'])
        .orderBy('category')
        .orderBy('code')
        .execute();
    },
  };
}
