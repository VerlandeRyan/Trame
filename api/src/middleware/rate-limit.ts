import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../errors.js';

export interface RateLimitSettings {
  windowMs: number;
  /** Nombre de requêtes autorisées par adresse IP pendant `windowMs`. */
  limit: number;
}

/** Connexion et création de compte : largement au-dessus d'un usage normal. */
export const AUTH_RATE_LIMIT: RateLimitSettings = { windowMs: 10 * 60 * 1000, limit: 30 };

/** Au-delà de la limite : `RATE_LIMITED` (429) avec l'en-tête `Retry-After`. */
export function createRateLimiter({ windowMs, limit }: RateLimitSettings): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError('RATE_LIMITED')),
  });
}
