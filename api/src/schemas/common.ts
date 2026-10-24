import { z } from 'zod';

/** Briques de validation partagées par les routes (publiques comme d'administration). */

/** Identifiant numérique d'une ressource, lu dans l'URL. */
export const idParams = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d{0,14}$/)
    .transform(Number),
});

/** Code de genre ou de format : slug en minuscules. */
export const genreCode = z
  .string()
  .trim()
  .max(50)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);

/** Nombre maximal de valeurs d'un même filtre. */
const MAX_FILTER_VALUES = 10;

export const MULTI_VALUE = `Liste séparée par des virgules (${MAX_FILTER_VALUES} valeurs au plus, doublons ignorés).`;

/** Liste séparée par des virgules (`status=ongoing,hiatus`), chaque valeur validée, sans doublon. */
export function commaSeparatedList<T extends z.ZodType<string, string>>(item: T) {
  return z
    .string()
    .transform((value) => [...new Set(value.split(',').map((part) => part.trim()))])
    .pipe(z.array(item).min(1).max(MAX_FILTER_VALUES));
}

/** `page` et `pageSize` d'une liste ; `items` nomme ce qu'elle contient (« Œuvres par page »). */
export function pageQuery(items: string, defaultPageSize = 20) {
  return {
    page: z.coerce.number().int().min(1).max(100_000).describe('Numéro de page.').default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .describe(`${items} par page.`)
      .default(defaultPageSize),
  };
}
