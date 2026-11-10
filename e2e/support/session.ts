/** Helpers that create test accounts and open their sessions in a browser context. */
import { expect, type BrowserContext } from '@playwright/test'

/** A valid (3 to 30 characters) and unique handle: the demo database is reloaded on every run. */
export function uniqueHandle(length = 12): string {
  const suffix = crypto.randomUUID().replaceAll('-', '')
  return `l${suffix}`.slice(0, length)
}

/**
 * Creates an account and opens its session in this context, without going through the handle
 * screen. Only Google is replaced, everything else is real.
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
