import type { Request } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroySession } from './session-actions.js';

function requestWithStore(destroy: (callback: (err?: unknown) => void) => void): Request {
  return { session: { destroy } } as unknown as Request;
}

describe('destroySession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('se termine sans bruit quand le store détruit la session', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await destroySession(requestWithStore((callback) => callback()));
    expect(logged).not.toHaveBeenCalled();
  });

  it("journalise l'erreur du store sans bloquer la requête", async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('store indisponible');
    await expect(
      destroySession(requestWithStore((callback) => callback(failure))),
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith(failure);
  });
});
