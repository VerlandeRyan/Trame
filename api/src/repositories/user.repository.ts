import type { Db, UserRole } from '../db/database.js';

/** Codes d'erreur PostgreSQL (SQLSTATE) traduits ici en résultats métier. */
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const HANDLE_UNIQUE_CONSTRAINT = 'app_user_handle_key';

/** Ce que l'API sait d'un utilisateur connecté : jamais l'e-mail ni l'identifiant Google. */
export interface AuthUser {
  id: number;
  handle: string;
  role: UserRole;
}

export interface NewUser {
  googleSub: string;
  email: string;
  handle: string;
}

/** `already_registered` : ce compte Google a déjà son compte (double envoi du formulaire). */
export type CreateUserResult =
  | { status: 'created'; user: AuthUser }
  | { status: 'handle_taken' }
  | { status: 'handle_rejected' }
  | { status: 'already_registered' };

export interface UserRepository {
  /** Compte actif d'un utilisateur ; `null` s'il n'existe pas ou a été supprimé. */
  findById(id: number): Promise<AuthUser | null>;
  /** Compte lié à un compte Google, y compris supprimé (`deleted: true`). */
  findByGoogleSub(sub: string): Promise<{ user: AuthUser; deleted: boolean } | null>;
  create(user: NewUser): Promise<CreateUserResult>;
}

interface PgError {
  code?: string;
  constraint?: string;
}

function isPgError(err: unknown): err is PgError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

/** Résultat métier d'une erreur de la base ; `null` si l'erreur n'en est pas un. */
function toCreateFailure(err: unknown): CreateUserResult | null {
  if (!isPgError(err)) return null;
  if (err.code === CHECK_VIOLATION) return { status: 'handle_rejected' };
  if (err.code !== UNIQUE_VIOLATION) return null;
  const handleTaken = err.constraint === HANDLE_UNIQUE_CONSTRAINT;
  return { status: handleTaken ? 'handle_taken' : 'already_registered' };
}

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
