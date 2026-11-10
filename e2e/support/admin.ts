/** Helper that signs the demo administrator into a browser context. */
import { expect, type BrowserContext } from '@playwright/test'

/** Fake sign-in code of the demo administrator account (from the demo data set), identified by `sub` and email. */
const DEMO_ADMIN_CODE = encodeURIComponent('e2e:demo-sub-admin:admin@exemple.test')

/**
 * Opens the demo administrator's session in this context through the API's real callback
 * (only Google is replaced).
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
