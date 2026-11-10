/** Promise wrappers around the callback-style session operations. */
import type { Request } from 'express';

/** Persists the session now, so a redirect cannot outrun the write. */
export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err: unknown) => (err ? reject(err as Error) : resolve()));
  });
}

/** Destroys the session; a store error is logged but does not block, since the session is dropped anyway. */
export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve) => {
    req.session.destroy((err: unknown) => {
      if (err) console.error(err);
      resolve();
    });
  });
}

/** Issues a new session identifier: use it on every change of status (sign-in). */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err: unknown) => (err ? reject(err as Error) : resolve()));
  });
}
