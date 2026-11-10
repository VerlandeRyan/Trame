/** Input schemas of the authentication routes. */
import { z } from 'zod';
import { handleSchema } from '../handle-rules.js';

/** Body to choose a handle and create the account. */
export const handleBody = z.strictObject({
  handle: handleSchema.describe(
    'Pseudo public, 3 à 30 caractères parmi lettres, chiffres, `_` et `-` ; unique sans tenir compte de la casse.',
  ),
});

/** A path of this site only (never another address); when invalid it is ignored and the user returns home. */
const localPath = z
  .string()
  .max(300)
  .regex(/^\/(?![/\\])[\x21-\x7e]*$/);

/** Query that starts the Google sign-in. */
export const loginQuery = z.object({
  returnTo: localPath
    .optional()
    .catch(undefined)
    .describe('Page du site où revenir après la connexion (chemin commençant par `/`).'),
});

/** A missing or repeated (array) parameter counts as "not provided": the callback fails without a JSON error, since Google sends the browser back here. */
const callbackParam = z.string().max(2048).optional().catch(undefined);

/** Parameters of Google's return to the callback. */
export const callbackQuery = z.object({
  code: callbackParam.describe('Code d’autorisation rendu par Google.'),
  state: callbackParam.describe('Valeur `state` posée au départ, qui doit revenir à l’identique.'),
  error: callbackParam.describe('Raison de l’échec rendue par Google (ex. `access_denied`).'),
});
