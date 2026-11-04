import { z } from 'zod';
import { PROFILE_VISIBILITIES } from '../domain/user-enums.js';
import { handleSchema } from '../handle-rules.js';
import { lang } from './common.js';

export const profileParams = z.object({
  handle: handleSchema.describe('Pseudo public du membre, sans tenir compte de la casse.'),
});

export const profileQuery = z.object({ lang: lang.optional() });

export const visibilityBody = z.strictObject({
  visibility: z
    .enum(PROFILE_VISIBILITIES)
    .describe('`public` par défaut ; `private` masque tout sauf le pseudo.'),
});
