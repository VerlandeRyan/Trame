import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

/**
 * Types des tables, ajoutés au fur et à mesure des dépôts qui en ont besoin.
 * La base reste la référence : `docs/modele-de-donnees.md` et `migrations/`.
 */
export interface Database {}

export type Db = Kysely<Database>;

export function createDb(connectionString: string): Db {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
  });
}
