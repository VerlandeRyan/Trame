import { expect, type BrowserContext } from '@playwright/test'

/** Compte administrateur du jeu de démo (`db/demo-data.sql`), identifié par `sub` et e-mail. */
const DEMO_ADMIN_CODE = encodeURIComponent('e2e:demo-sub-admin:admin@exemple.test')

/**
 * Ouvre la session du compte administrateur de démo dans ce contexte, par le vrai callback de
 * l'API (seul Google est remplacé, voir `api/src/e2e/fake-google.ts`).
 */
export async function signInAsAdmin(context: BrowserContext): Promise<void> {
  const start = await context.request.get('/api/v1/auth/google?returnTo=%2F', { maxRedirects: 0 })
  const state = new URL(start.headers().location ?? '').searchParams.get('state') as string
  const callback = await context.request.get(
    `/api/v1/auth/google/callback?code=${DEMO_ADMIN_CODE}&state=${state}`,
    { maxRedirects: 0 },
  )
  expect(callback.status()).toBe(302)
}
