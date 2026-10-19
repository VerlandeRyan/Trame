import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createAuthController } from '../controllers/auth.controller.js';
import { handleSchema } from '../handle-rules.js';
import { rateLimitOptions, type RateLimitSettings } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import type { AuthService } from '../services/auth.service.js';

export const handleBody = z.strictObject({
  handle: handleSchema.describe(
    'Pseudo public, 3 à 30 caractères parmi lettres, chiffres, `_` et `-` ; unique sans tenir compte de la casse.',
  ),
});

/** Chemin du site seulement (jamais une autre adresse) ; invalide, il est ignoré et on revient à l'accueil. */
const localPath = z
  .string()
  .max(300)
  .regex(/^\/(?![/\\])[\x21-\x7e]*$/);

export const loginQuery = z.object({
  returnTo: localPath
    .optional()
    .catch(undefined)
    .describe('Page du site où revenir après la connexion (chemin commençant par `/`).'),
});

export function createAuthRouter(
  service: AuthService,
  options: { webOrigin: string; secureCookies: boolean; rateLimit: RateLimitSettings },
): Router {
  const limiter = rateLimit(rateLimitOptions(options.rateLimit));
  const controller = createAuthController(service, options);
  const router = Router();
  router.get('/google', limiter, validate('query', loginQuery), controller.startGoogleLogin);
  router.get('/google/callback', limiter, controller.finishGoogleLogin);
  router.get('/me', controller.getAuthStatus);
  router.post('/handle', limiter, validate('body', handleBody), controller.createAccount);
  router.post('/cancel', controller.signOut);
  router.post('/logout', controller.signOut);
  return router;
}
