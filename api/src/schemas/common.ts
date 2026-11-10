/** Validation building blocks shared by the public and administration routes. */
import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../config.js';

/** Application language; when absent, titles and synopses come back in the original language. */
export const lang = z
  .enum(SUPPORTED_LANGUAGES)
  .describe('Langue de l’application ; absente, titres et synopsis sont dans la langue originale.');

/** Numeric identifier of a resource, read from the URL. */
export const idParams = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d{0,14}$/)
    .transform(Number),
});

/** Genre or format code: a lowercase slug. */
export const genreCode = z
  .string()
  .trim()
  .max(50)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);

/** Maximum number of values of one filter. */
const MAX_FILTER_VALUES = 10;

/** Documentation sentence shared by every multi-value filter. */
export const MULTI_VALUE = `Liste séparée par des virgules (${MAX_FILTER_VALUES} valeurs au plus, doublons ignorés).`;

/** Comma-separated list (`status=ongoing,hiatus`), each value validated, duplicates removed. */
export function commaSeparatedList<T extends z.ZodType<string, string>>(item: T) {
  return z
    .string()
    .transform((value) => [...new Set(value.split(',').map((part) => part.trim()))])
    .pipe(z.array(item).min(1).max(MAX_FILTER_VALUES));
}

/** `page` and `pageSize` of a list; `items` names what it holds (used in the documentation text). */
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
