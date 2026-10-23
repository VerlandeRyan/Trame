import { expect, type BrowserContext } from '@playwright/test'

/** Pseudo valide (3 à 30 caractères) et unique : une base de démo est rechargée à chaque exécution. */
export function uniqueHandle(length = 12): string {
  const suffix = crypto.randomUUID().replaceAll('-', '')
  return `l${suffix}`.slice(0, length)
}

/**
 * Crée un compte et ouvre sa session dans ce contexte, sans passer par l'écran du pseudo.
 * Seul Google est remplacé (`api/src/e2e/fake-google.ts`), tout le reste est réel.
 */
export async function signUp(context: BrowserContext, handle = uniqueHandle()): Promise<string> {
  const start = await context.request.get('/api/v1/auth/google?returnTo=%2F', { maxRedirects: 0 })
  const state = new URL(start.headers().location ?? '').searchParams.get('state') as string
  const code = encodeURIComponent(`e2e:${handle}:${handle}@example.test`)
  await context.request.get(`/api/v1/auth/google/callback?code=${code}&state=${state}`, {
    maxRedirects: 0,
  })
  const created = await context.request.post('/api/v1/auth/handle', { data: { handle } })
  expect(created.status()).toBe(201)
  return handle
}
