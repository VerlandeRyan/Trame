import { z } from 'zod';

/**
 * Langues acceptées par le paramètre `lang` (ADR 0007). Liste de configuration, pas de la base :
 * en ajouter une est un changement de code sans migration.
 */
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL manquante (voir .env.example)'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuration invalide : ${problems.join(' ; ')}`);
  }
  return parsed.data;
}
