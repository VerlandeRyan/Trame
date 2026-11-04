import { z } from 'zod';
import { handleSchema } from '../handle-rules.js';

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

/** Un paramètre absent ou répété (tableau) vaut « non fourni » : le retour échoue sans erreur JSON, Google ramène le navigateur ici. */
const callbackParam = z.string().max(2048).optional().catch(undefined);

/** Paramètres du retour de Google (`GET /auth/google/callback`). */
export const callbackQuery = z.object({
  code: callbackParam.describe('Code d’autorisation rendu par Google.'),
  state: callbackParam.describe('Valeur `state` posée au départ, qui doit revenir à l’identique.'),
  error: callbackParam.describe('Raison de l’échec rendue par Google (ex. `access_denied`).'),
});
