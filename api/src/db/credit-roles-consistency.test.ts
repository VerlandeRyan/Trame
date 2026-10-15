import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CREDIT_ROLE_RANK } from './database.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const client = new pg.Client({ connectionString });

beforeAll(() => client.connect());
afterAll(() => client.end());

describe('rôles de crédit', () => {
  it('le CHECK de work_credit.role correspond exactement aux rôles connus du code', async () => {
    const res = await client.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conrelid = 'work_credit'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%role%'`,
    );
    expect(res.rows).toHaveLength(1);

    const inDatabase = [...res.rows[0]!.definition.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    const inCode = Object.keys(CREDIT_ROLE_RANK).sort();
    expect(inDatabase).toEqual(inCode);
  });
});
