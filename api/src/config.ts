/** Reads and validates the environment variables into a typed configuration. */
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * Languages accepted by the `lang` parameter. A configuration list, not a database one: adding
 * a language is a code change without a migration.
 */
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
/** One of the supported interface languages. */
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Text variable where an empty string counts as unset. */
const optionalText = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

/** Upper bound of the trusted proxy hops setting. */
const MAX_PROXY_HOPS = 10;

/** Shape of the raw environment variables. */
const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL manquante (voir .env.example)'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: optionalText,
    /** Front-end origin: redirects after sign-in and the allowed request origin. */
    WEB_ORIGIN: z.url().default('http://localhost:3001'),
    /** Signing secret of the session cookie; required in production. */
    SESSION_SECRET: optionalText.pipe(z.string().min(32).optional()),
    /** Secure cookie flag; enabled by default in production only. */
    SECURE_COOKIES: optionalText.pipe(z.enum(['true', 'false']).optional()),
    /** Number of reverse proxies to trust, so that the secure cookie can be set. */
    TRUST_PROXY: optionalText
      .transform((value) => (value === undefined ? 0 : Number(value)))
      .pipe(z.number().int().min(0).max(MAX_PROXY_HOPS)),
    /** Google OAuth client; without it, sign-in answers `AUTH_UNAVAILABLE`. */
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

/** Validated configuration used by the server. */
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

/** Parses the environment into a `Config`; throws an error listing every invalid variable. */
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
    // Outside production a random secret is enough: sessions do not survive a restart.
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
