import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTION_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  POOL_MAX,
  STATEMENT_TIMEOUT_MS,
  createPool,
} from './database.js';

// Créer un pool n'ouvre aucune connexion : l'adresse n'a pas besoin d'exister.
const pools: ReturnType<typeof createPool>[] = [];
function newPool() {
  const pool = createPool('postgres://user:password@localhost:5432/absent');
  pools.push(pool);
  return pool;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(pools.splice(0).map((pool) => pool.end()));
});

describe('createPool', () => {
  it('borne la taille du pool et les délais', () => {
    const { options } = newPool();
    expect(options.max).toBe(POOL_MAX);
    expect(options.connectionTimeoutMillis).toBe(CONNECTION_TIMEOUT_MS);
    expect(options.idleTimeoutMillis).toBe(IDLE_TIMEOUT_MS);
    expect(options.statement_timeout).toBe(STATEMENT_TIMEOUT_MS);
  });

  it("journalise l'erreur d'un client inactif au lieu de faire tomber le processus", () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('connexion coupée');
    // Sans écouteur, `emit('error')` lèverait : c'est ce qui arrêterait Node.
    expect(() => newPool().emit('error', failure)).not.toThrow();
    expect(logged).toHaveBeenCalledWith(failure);
  });
});
