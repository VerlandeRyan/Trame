import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/database.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';
import { visibleWork } from './work-sql.js';

const seed = readFileSync(new URL('../../../db/demo-data.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString });
const db = createDb(connectionString);

async function visibleIds(): Promise<number[]> {
  const rows = await db.selectFrom('work').select('work.id').where(visibleWork).execute();
  return rows.map((row) => row.id);
}

beforeAll(async () => {
  await client.connect();
  await client.query(seed);
});

afterAll(async () => {
  await client.end();
  await db.destroy();
});

describe('visibleWork', () => {
  it('exclut une œuvre archivée et la rend à nouveau une fois désarchivée', async () => {
    const [first] = await visibleIds();
    expect(first).toBeDefined();

    await client.query('UPDATE work SET deleted_at = now() WHERE id = $1', [first]);
    expect(await visibleIds()).not.toContain(first);

    await client.query('UPDATE work SET deleted_at = NULL WHERE id = $1', [first]);
    expect(await visibleIds()).toContain(first);
  });
});
