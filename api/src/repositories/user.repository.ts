/** Storage of user accounts. */
import type { Db, UserRole } from '../db/database.js';

/** PostgreSQL error codes (SQLSTATE) translated here into business results. */
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
/** Name of the unique constraint on handles. */
const HANDLE_UNIQUE_CONSTRAINT = 'app_user_handle_key';

/** What the API knows about a signed-in user: never the email or the Google identifier. */
export interface AuthUser {
  id: number;
  handle: string;
  role: UserRole;
}

/** Data needed to create an account. */
export interface NewUser {
  googleSub: string;
  email: string;
  handle: string;
}

/** `already_registered`: this Google account already has an account (form submitted twice). */
export type CreateUserResult =
  | { status: 'created'; user: AuthUser }
  | { status: 'handle_taken' }
  | { status: 'handle_rejected' }
  | { status: 'already_registered' };

/** User queries. */
export interface UserRepository {
  /** Active account of a user; `null` if it does not exist or was deleted. */
  findById(id: number): Promise<AuthUser | null>;
  /** Account linked to a Google account, including a deleted one (`deleted: true`). */
  findByGoogleSub(sub: string): Promise<{ user: AuthUser; deleted: boolean } | null>;
  /** Creates an account, or reports why it could not be created. */
  create(user: NewUser): Promise<CreateUserResult>;
}

/** The fields of a PostgreSQL error the code relies on. */
interface PgError {
  code?: string;
  constraint?: string;
}

/** Whether an unknown error looks like a PostgreSQL error. */
function isPgError(err: unknown): err is PgError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

/** Business result of a database error; `null` when the error is not an expected one. */
function toCreateFailure(err: unknown): CreateUserResult | null {
  if (!isPgError(err)) return null;
  if (err.code === CHECK_VIOLATION) return { status: 'handle_rejected' };
  if (err.code !== UNIQUE_VIOLATION) return null;
  const handleTaken = err.constraint === HANDLE_UNIQUE_CONSTRAINT;
  return { status: handleTaken ? 'handle_taken' : 'already_registered' };
}

/** Creates the user repository. */
export function createUserRepository(db: Db): UserRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom('app_user')
        .select(['id', 'handle', 'role'])
        .where('id', '=', id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
      return row ?? null;
    },

    async findByGoogleSub(sub) {
      const row = await db
        .selectFrom('app_user')
        .select(['id', 'handle', 'role', 'deleted_at'])
        .where('google_sub', '=', sub)
        .executeTakeFirst();
      if (!row) return null;
      const { deleted_at, ...user } = row;
      return { user, deleted: deleted_at !== null };
    },

    async create({ googleSub, email, handle }) {
      try {
        const user = await db
          .insertInto('app_user')
          .values({ google_sub: googleSub, email, handle, display_name: null, deleted_at: null })
          .returning(['id', 'handle', 'role'])
          .executeTakeFirstOrThrow();
        return { status: 'created', user };
      } catch (err) {
        const failure = toCreateFailure(err);
        if (failure) return failure;
        throw err;
      }
    },
  };
}
