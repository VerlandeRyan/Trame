import type { RequestHandler } from 'express';
import type { z, ZodType } from 'zod';
import { AppError } from '../errors.js';

type Source = 'body' | 'query' | 'params';

/** Paramètres d'une issue Zod utiles au front pour son propre message ; jamais la valeur saisie. */
const ISSUE_PARAMS = ['expected', 'origin', 'minimum', 'maximum', 'format', 'values'] as const;

type ParamValue = string | number | boolean | (string | number)[];

function isParamValue(value: unknown): value is ParamValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return true;
  return Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number');
}

/** Une erreur de champ : `path` + `code` Zod + paramètres, sans message (le front traduit). */
function toDetail(issue: { path: PropertyKey[]; code: string }) {
  const params: Record<string, ParamValue> = {};
  for (const key of ISSUE_PARAMS) {
    const value = (issue as Record<string, unknown>)[key];
    if (isParamValue(value)) params[key] = value;
  }
  return { path: issue.path, code: issue.code, ...params };
}

/**
 * Valeur déjà analysée par `validate(source, schema)` : le schéma ne sert ici qu'à la typer,
 * ce qui évite un cast dans chaque contrôleur.
 */
export function validated<S extends ZodType>(_schema: S, value: unknown): z.output<S> {
  return value as z.output<S>;
}

/** Valide `req.body`, `req.query` ou `req.params` avec un schéma Zod ; remplace la valeur par la version analysée. */
export function validate(source: Source, schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map(toDetail);
      next(new AppError('VALIDATION_ERROR', details));
      return;
    }
    // `req.query` est en lecture seule sous Express 5 : on le redéfinit explicitement.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
}
