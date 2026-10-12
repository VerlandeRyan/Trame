import type { Db, GenreCategory } from '../db/database.js';

export interface GenreRecord {
  code: string;
  category: GenreCategory;
}

export interface GenreRepository {
  /** Tous les genres et formats, triés par catégorie puis par code. */
  list(): Promise<GenreRecord[]>;
}

export function createGenreRepository(db: Db): GenreRepository {
  return {
    async list() {
      return db.selectFrom('genre').select(['code', 'category']).orderBy('category').orderBy('code').execute();
    },
  };
}
