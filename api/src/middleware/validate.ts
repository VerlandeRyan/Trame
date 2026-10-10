import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors.js';

type Source = 'body' | 'query' | 'params';

/** Valide `req.body`, `req.query` ou `req.params` avec un schéma Zod ; remplace la valeur par la version analysée. */
export function validate(source: Source, schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path, message: i.message }));
      next(new AppError('VALIDATION_ERROR', details));
      return;
    }
    // `req.query` est en lecture seule sous Express 5 : on le redéfinit explicitement.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
}
