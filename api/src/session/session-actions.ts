import type { Request } from 'express';

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err: unknown) => (err ? reject(err as Error) : resolve()));
  });
}

/** Une erreur du store est journalisée mais ne bloque pas : la session est de toute façon abandonnée. */
export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve) => {
    req.session.destroy((err: unknown) => {
      if (err) console.error(err);
      resolve();
    });
  });
}

/** Nouvel identifiant de session : à utiliser à chaque changement de statut (connexion). */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err: unknown) => (err ? reject(err as Error) : resolve()));
  });
}
