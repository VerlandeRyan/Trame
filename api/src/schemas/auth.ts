import { z } from 'zod';

/** Un paramètre absent ou répété (tableau) vaut « non fourni » : le retour échoue sans erreur JSON, Google ramène le navigateur ici. */
const callbackParam = z.string().max(2048).optional().catch(undefined);

/** Paramètres du retour de Google (`GET /auth/google/callback`). */
export const callbackQuery = z.object({
  code: callbackParam.describe('Code d’autorisation rendu par Google.'),
  state: callbackParam.describe('Valeur `state` posée au départ, qui doit revenir à l’identique.'),
  error: callbackParam.describe('Raison de l’échec rendue par Google (ex. `access_denied`).'),
});
