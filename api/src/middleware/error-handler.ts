import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND'));
};

function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { type?: unknown }).type === 'entity.parse.failed'
  );
}

/** Réponse d'erreur uniforme : `{ code, message, details? }`, jamais de détail interne. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (isBodyParseError(err)) {
    appError = new AppError('INVALID_JSON');
  } else {
    console.error(err);
    appError = new AppError('INTERNAL_ERROR');
  }
  res.status(appError.status).json(appError.toBody());
};
