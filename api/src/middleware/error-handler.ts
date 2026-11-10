/** Final middleware: unknown routes and the uniform error response. */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors.js';

/** Turns any unmatched request into a not-found error. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND'));
};

/** Whether the error comes from a malformed JSON body. */
function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { type?: unknown }).type === 'entity.parse.failed'
  );
}

/** Uniform error response `{ code, message, details? }`, never exposing internal details. */
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
