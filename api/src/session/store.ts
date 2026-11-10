/** Session store persisting sessions in the database. */
import session, { type SessionData } from 'express-session';
import type { SessionRepository } from '../repositories/session.repository.js';

/** Lifetime of a session when the cookie gives none (should not happen). */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type Callback<T = void> = (err?: unknown, result?: T) => void;

/** Expiry date of a session. */
function expiryOf(data: SessionData): Date {
  const expires = data.cookie.expires;
  return expires ? new Date(expires) : new Date(Date.now() + DEFAULT_TTL_MS);
}

/** `express-session` store backed by the session table (the SQL lives in the repository, not here). */
export class SessionStore extends session.Store {
  constructor(private readonly sessions: SessionRepository) {
    super();
  }

  override get(sid: string, callback: Callback<SessionData | null>): void {
    this.sessions
      .find(sid)
      .then((content) => callback(null, (content as SessionData | null) ?? null))
      .catch(callback);
  }

  override set(sid: string, data: SessionData, callback?: Callback): void {
    this.sessions
      .save(sid, data, expiryOf(data))
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }

  override touch(sid: string, data: SessionData, callback?: Callback): void {
    this.sessions
      .touch(sid, expiryOf(data))
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }

  override destroy(sid: string, callback?: Callback): void {
    this.sessions
      .remove(sid)
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }
}
