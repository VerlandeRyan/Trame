import { Router } from 'express';
import { z } from 'zod';
import { createAuthController } from '../controllers/auth.controller.js';
import { handleSchema } from '../handle-rules.js';
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
  options: { webOrigin: string; secureCookies: boolean },
): Router {
  const controller = createAuthController(service, options);
  const router = Router();
  router.get('/google', validate('query', loginQuery), controller.startGoogleLogin);
  router.get('/google/callback', controller.finishGoogleLogin);
  router.get('/me', controller.getAuthStatus);
  router.post('/handle', validate('body', handleBody), controller.createAccount);
  router.post('/cancel', controller.signOut);
  router.post('/logout', controller.signOut);
  return router;
}
