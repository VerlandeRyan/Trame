/** Database access: Kysely instance, connection pool and the table and enum types the code uses. */
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

/** Display rank of a credit role (0 = first). Exhaustive: the compiler forces a new role to be ranked here. */
export const CREDIT_ROLE_RANK: Record<CreditRole, number> = {
  story: 0,
  art: 1,
  colors: 2,
  other: 3,
};

/**
 * Table types, generated from the migrated database: never edit `generated.ts` by hand.
 * The database stays the reference (`migrations/` and the data model document).
 */
export type {
  DB as Database,
  LibraryEntry as LibraryEntryRow,
  Person as PersonRow,
  ReadingEvent as ReadingEventRow,
} from './generated.js';

/** Typed query builder over the database. */
export type Db = Kysely<DB>;

const { INT8, DATE } = pg.types.builtins;

/** Connection pool settings; estimated values, to be tuned. */
export const POOL_MAX = 10;
export const CONNECTION_TIMEOUT_MS = 5_000;
export const STATEMENT_TIMEOUT_MS = 30_000;
export const IDLE_TIMEOUT_MS = 30_000;

/** Creates the connection pool, with `bigint` read as numbers and calendar dates kept as `YYYY-MM-DD`. */
export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    max: POOL_MAX,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    types: {
      getTypeParser: ((oid: number, format?: 'text' | 'binary') => {
        // bigint ids and counters become numbers (far below 2^53).
        if (oid === INT8) return Number;
        // Calendar dates stay `YYYY-MM-DD`, with no timezone shift.
        if (oid === DATE) return (value: string) => value;
        return pg.types.getTypeParser(oid, format);
      }) as typeof pg.types.getTypeParser,
    },
  });
  // Without a listener, losing an idle client (restarted database) would crash the process.
  pool.on('error', (err) => console.error(err));
  return pool;
}

/** Creates the typed database connection on top of a new pool. */
export function createDb(connectionString: string): Db {
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: createPool(connectionString) }),
  });
}
