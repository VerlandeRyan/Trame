import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createAuthController } from '../controllers/auth.controller.js';
import { rateLimitOptions, type RateLimitSettings } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import { callbackQuery, handleBody, loginQuery } from '../schemas/auth.js';
import type { AuthService } from '../services/auth.service.js';

export function createAuthRouter(
  service: AuthService,
  options: { webOrigin: string; secureCookies: boolean; rateLimit: RateLimitSettings },
): Router {
  const limiter = rateLimit(rateLimitOptions(options.rateLimit));
  const controller = createAuthController(service, options);
  const router = Router();
  router.get('/google', limiter, validate('query', loginQuery), controller.startGoogleLogin);
  router.get(
    '/google/callback',
    limiter,
    validate('query', callbackQuery),
    controller.finishGoogleLogin,
  );
  router.get('/me', controller.getAuthStatus);
  router.post('/handle', limiter, validate('body', handleBody), controller.createAccount);
  router.post('/cancel', controller.signOut);
  router.post('/logout', controller.signOut);
  return router;
}
