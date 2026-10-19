import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * Langues acceptées par le paramètre `lang` (ADR 0007). Liste de configuration, pas de la base :
 * en ajouter une est un changement de code sans migration.
 */
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const MAX_PROXY_HOPS = 10;

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL manquante (voir .env.example)'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: optionalText,
    /** Origine du front : redirections après connexion et contrôle de l'en-tête `Origin`. */
    WEB_ORIGIN: z.url().default('http://localhost:3001'),
    /** Secret de signature du cookie de session ; obligatoire en production. */
    SESSION_SECRET: optionalText.pipe(z.string().min(32).optional()),
    /** Cookie `Secure` ; par défaut actif en production seulement. */
    SECURE_COOKIES: optionalText.pipe(z.enum(['true', 'false']).optional()),
    /** Pour que le cookie `Secure` soit posé. */
    TRUST_PROXY: optionalText
      .transform((value) => (value === undefined ? 0 : Number(value)))
      .pipe(z.number().int().min(0).max(MAX_PROXY_HOPS)),
    /** Client OAuth Google ; sans eux, la connexion répond `AUTH_UNAVAILABLE`. */
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    GOOGLE_REDIRECT_URI: optionalText.pipe(z.url().optional()),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.SESSION_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'obligatoire en production (32 caractères au moins)',
      });
    }
  });

export interface Config {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: string | undefined;
  WEB_ORIGIN: string;
  SESSION_SECRET: string;
  SECURE_COOKIES: boolean;
  TRUST_PROXY: number;
  GOOGLE?: { clientId: string; clientSecret: string; redirectUri: string };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuration invalide : ${problems.join(' ; ')}`);
  }
  const data = parsed.data;
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = data;
  const redirectUri = data.GOOGLE_REDIRECT_URI;
  const config: Config = {
    DATABASE_URL: data.DATABASE_URL,
    PORT: data.PORT,
    NODE_ENV: data.NODE_ENV,
    WEB_ORIGIN: new URL(data.WEB_ORIGIN).origin,
    // Hors production, un secret aléatoire suffit : les sessions ne survivent pas au redémarrage.
    SESSION_SECRET: data.SESSION_SECRET ?? randomBytes(32).toString('hex'),
    SECURE_COOKIES: data.SECURE_COOKIES
      ? data.SECURE_COOKIES === 'true'
      : data.NODE_ENV === 'production',
    TRUST_PROXY: data.TRUST_PROXY,
  };
  if (clientId && clientSecret && redirectUri) {
    config.GOOGLE = { clientId, clientSecret, redirectUri };
  }
  return config;
}
