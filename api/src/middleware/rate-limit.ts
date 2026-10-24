import type { Options } from 'express-rate-limit';
import { AppError } from '../errors.js';

export interface RateLimitSettings {
  windowMs: number;
  /** Nombre de requêtes autorisées par adresse IP pendant `windowMs`. */
  limit: number;
}

/** Connexion et création de compte : largement au-dessus d'un usage normal. */
export const AUTH_RATE_LIMIT: RateLimitSettings = { windowMs: 10 * 60 * 1000, limit: 30 };

/** Écritures de la liste de lecture : de quoi enchaîner des +1 sans gêner un usage normal. */
export const LIBRARY_RATE_LIMIT: RateLimitSettings = { windowMs: 60 * 1000, limit: 120 };

/** Écritures du catalogue par les administrateurs. */
export const ADMIN_RATE_LIMIT: RateLimitSettings = { windowMs: 60 * 1000, limit: 120 };

/**
 * Options communes à tous les limiteurs ; la route appelle elle-même `rateLimit(...)`.
 * Au-delà de la limite : `RATE_LIMITED` (429) avec l'en-tête `Retry-After`.
 */
export function rateLimitOptions({ windowMs, limit }: RateLimitSettings): Partial<Options> {
  return {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError('RATE_LIMITED')),
  };
}
