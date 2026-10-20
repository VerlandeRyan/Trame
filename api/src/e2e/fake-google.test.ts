import { describe, expect, it } from 'vitest';
import { createFakeGoogleClient } from './fake-google.js';

const CALLBACK = 'http://web.test/api/v1/auth/google/callback';

describe('createFakeGoogleClient', () => {
  const client = createFakeGoogleClient(CALLBACK);

  it('renvoie vers le callback avec une identité neuve à chaque tentative', async () => {
    const first = await client.start();
    const second = await client.start();
    const url = new URL(first.url);

    expect(url.origin + url.pathname).toBe(CALLBACK);
    expect(url.searchParams.get('state')).toBe(first.state);
    expect(first.url).not.toBe(second.url);
  });

  it("lit l'identité dans le code", async () => {
    const { url, ...secrets } = await client.start();
    const code = new URL(url).searchParams.get('code') as string;

    const identity = await client.verify(code, secrets);

    expect(identity.email).toBe(`${identity.sub}@example.test`);
    await expect(client.verify('e2e:abc:abc@example.test', secrets)).resolves.toEqual({
      sub: 'abc',
      email: 'abc@example.test',
    });
  });

  it('refuse un code qui ne vient pas de la doublure', async () => {
    const secrets = { codeVerifier: 'e2e', nonce: 'e2e' };

    await expect(client.verify('real-google-code', secrets)).rejects.toMatchObject({
      code: 'AUTH_STATE_INVALID',
    });
    await expect(client.verify('e2e:seul', secrets)).rejects.toMatchObject({
      code: 'AUTH_STATE_INVALID',
    });
  });
});
