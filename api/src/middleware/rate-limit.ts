/** Rate limit settings and the options shared by every limiter. */
import type { Options } from 'express-rate-limit';
import { AppError } from '../errors.js';

/** Time window and request quota of one limiter. */
export interface RateLimitSettings {
  windowMs: number;
  /** Number of requests allowed per IP address during `windowMs`. */
  limit: number;
}

/** Sign-in and account creation: well above normal use. */
export const AUTH_RATE_LIMIT: RateLimitSettings = { windowMs: 10 * 60 * 1000, limit: 30 };

/** Reading-list writes: enough to chain +1 clicks without hindering normal use. */
export const LIBRARY_RATE_LIMIT: RateLimitSettings = { windowMs: 60 * 1000, limit: 120 };

/** Catalogue writes by administrators. */
export const ADMIN_RATE_LIMIT: RateLimitSettings = { windowMs: 60 * 1000, limit: 120 };

/**
 * Options shared by all limiters; the route itself calls `rateLimit(...)`.
 * Beyond the limit: `RATE_LIMITED` (429) with a `Retry-After` header.
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
