import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { CreditRole } from '../domain/catalogue-enums.js';
import type { DB } from './generated.js';

export type {
  CreditRole,
  ExternalLinkKind,
  GenreCategory,
  PersonKind,
  PublisherKind,
  RelationKind,
  SynopsisSource,
  TitleKind,
  WorkStatus,
  WorkType,
} from '../domain/catalogue-enums.js';
export type { LibraryStatus, ProfileVisibility, UserRole } from '../domain/user-enums.js';

/** Importance d'un rôle pour l'affichage (0 = en premier). Exhaustif : ajouter un rôle ici est imposé par le compilateur. */
export const CREDIT_ROLE_RANK: Record<CreditRole, number> = {
  story: 0,
  art: 1,
  colors: 2,
  other: 3,
};

/**
 * Types des tables, générés depuis la base migrée (`npm run db:codegen`, voir `.kysely-codegenrc.json`) :
 * ne pas modifier `generated.ts` à la main. La base reste la référence : `migrations/` et
 * `docs/modele-de-donnees.md`.
 */
export type {
  DB as Database,
  LibraryEntry as LibraryEntryRow,
  Person as PersonRow,
  ReadingEvent as ReadingEventRow,
} from './generated.js';

export type Db = Kysely<DB>;

const { INT8, DATE } = pg.types.builtins;

export const POOL_MAX = 10;
export const CONNECTION_TIMEOUT_MS = 5_000;
export const STATEMENT_TIMEOUT_MS = 30_000;
export const IDLE_TIMEOUT_MS = 30_000;

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    max: POOL_MAX,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    types: {
      getTypeParser: ((oid: number, format?: 'text' | 'binary') => {
        // Identifiants et compteurs bigint : des nombres (bien en deçà de 2^53).
        if (oid === INT8) return Number;
        // Dates calendaires : conservées en `YYYY-MM-DD`, sans décalage de fuseau.
        if (oid === DATE) return (value: string) => value;
        return pg.types.getTypeParser(oid, format);
      }) as typeof pg.types.getTypeParser,
    },
  });
  // Sans écouteur, la coupure d'un client inactif (base redémarrée) ferait tomber le processus.
  pool.on('error', (err) => console.error(err));
  return pool;
}

export function createDb(connectionString: string): Db {
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: createPool(connectionString) }),
  });
}
