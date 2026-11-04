import { expect, test } from '@playwright/test'

const SECURITY_HEADERS = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
}

// Le front pose le socle d'en-têtes sur ses pages comme sur le relais vers l'API.
for (const path of [
  '/',
  '/en/',
  '/search?q=basalte',
  '/work/1-les-lanternes-de-brume',
  '/api/v1/works',
]) {
  test(`en-têtes de sécurité : ${path}`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    expect(response.headers()).toMatchObject(SECURITY_HEADERS)
  })
}

test('en-têtes de sécurité : page inconnue (404)', async ({ request }) => {
  const response = await request.get('/page-qui-n-existe-pas')
  expect(response.status()).toBe(404)
  expect(response.headers()).toMatchObject(SECURITY_HEADERS)
})
