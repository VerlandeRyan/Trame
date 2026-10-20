import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const script = fileURLToPath(new URL('../../scripts/promote-admin.mjs', import.meta.url));
const client = new pg.Client({ connectionString });

beforeAll(() => client.connect());
afterAll(() => client.end());
beforeEach(async () => {
  await client.query('TRUNCATE app_user RESTART IDENTITY CASCADE');
  await client.query(
    `INSERT INTO app_user (email, google_sub, handle) VALUES
       ('ryan@exemple.test', 'sub-1', 'Ryan'), ('lea@exemple.test', 'sub-2', 'Lea')`,
  );
});

async function promote(...args: string[]): Promise<string> {
  const { stdout } = await promisify(execFile)('node', [script, ...args], {
    env: { ...process.env, DATABASE_URL: connectionString },
  });
  return stdout;
}

const rolesByHandle = async () =>
  Object.fromEntries(
    (await client.query('SELECT handle, role FROM app_user')).rows.map((r) => [r.handle, r.role]),
  );

describe('db:promote-admin', () => {
  it('promeut le compte demandé, sans tenir compte de la casse', async () => {
    expect(await promote('ryan')).toContain('Ryan est maintenant administrateur');
    expect(await rolesByHandle()).toEqual({ Ryan: 'admin', Lea: 'user' });
  });

  it('ne fait rien quand un administrateur existe déjà', async () => {
    await promote('Ryan');
    expect(await promote('Lea')).toContain('un administrateur existe déjà');
    expect(await rolesByHandle()).toEqual({ Ryan: 'admin', Lea: 'user' });
  });

  it('signale un handle inconnu', async () => {
    expect(await promote('Inconnu')).toContain('aucun compte actif');
    expect(await rolesByHandle()).toEqual({ Ryan: 'user', Lea: 'user' });
  });

  it('ignore un compte supprimé', async () => {
    await client.query("UPDATE app_user SET deleted_at = now() WHERE handle = 'Ryan'");
    expect(await promote('Ryan')).toContain('aucun compte actif');
  });

  it('exige un handle', async () => {
    await expect(promote()).rejects.toMatchObject({ code: 1 });
  });
});
