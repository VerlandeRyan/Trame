/** PostgreSQL error codes (SQLSTATE) the repositories translate into business results. */

/** A duplicate on a unique constraint. */
export const UNIQUE_VIOLATION = '23505';
/** A row refused by a `CHECK` rule. */
export const CHECK_VIOLATION = '23514';
/** A row another row still cites (foreign key, `NO ACTION`). */
export const FOREIGN_KEY_VIOLATION = '23503';

/** The fields of a PostgreSQL error the code relies on. */
export interface PgError {
  code?: string;
  constraint?: string;
}

/** Whether an unknown error looks like a PostgreSQL error. */
export function isPgError(err: unknown): err is PgError {
  return typeof err === 'object' && err !== null && 'code' in err;
}
