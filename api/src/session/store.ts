import session, { type SessionData } from 'express-session';
import type { SessionRepository } from '../repositories/session.repository.js';

/** Durée de vie d'une session si le cookie n'en précise pas (ne devrait pas arriver). */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type Callback<T = void> = (err?: unknown, result?: T) => void;

function expiryOf(data: SessionData): Date {
  const expires = data.cookie.expires;
  return expires ? new Date(expires) : new Date(Date.now() + DEFAULT_TTL_MS);
}

/** Store `express-session` adossé à la table `session` (SQL dans le dépôt, pas ici). */
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
