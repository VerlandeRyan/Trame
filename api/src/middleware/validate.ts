/** Request validation middleware built on Zod schemas. */
import type { RequestHandler } from 'express';
import type { z, ZodType } from 'zod';
import { AppError } from '../errors.js';

/** Part of the request that gets validated. */
type Source = 'body' | 'query' | 'params';

/** Parameters of a Zod issue the front end needs for its own message; never the typed value. */
const ISSUE_PARAMS = ['expected', 'origin', 'minimum', 'maximum', 'format', 'values'] as const;

type ParamValue = string | number | boolean | (string | number)[];

/** Whether a Zod issue parameter is safe to expose. */
function isParamValue(value: unknown): value is ParamValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return true;
  return Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number');
}

/** One field error: `path` + Zod `code` + parameters, with no message (the front end translates). */
function toDetail(issue: { path: PropertyKey[]; code: string }) {
  const params: Record<string, ParamValue> = {};
  for (const key of ISSUE_PARAMS) {
    const value = (issue as Record<string, unknown>)[key];
    if (isParamValue(value)) params[key] = value;
  }
  return { path: issue.path, code: issue.code, ...params };
}

/**
 * Types a value already parsed by `validate(source, schema)`: the schema only provides the type here,
 * which avoids a cast in every controller.
 */
export function validated<S extends ZodType>(_schema: S, value: unknown): z.output<S> {
  return value as z.output<S>;
}

/** Validates `req.body`, `req.query` or `req.params` with a Zod schema and replaces it with the parsed value. */
export function validate(source: Source, schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map(toDetail);
      next(new AppError('VALIDATION_ERROR', details));
      return;
    }
    // `req.query` is read-only in Express 5: redefine it explicitly.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
}
