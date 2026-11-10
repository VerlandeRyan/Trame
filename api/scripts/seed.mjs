// Loads db/demo-data.sql (fictitious demo data) into the TEST database (TEST_DATABASE_URL).
// The file empties the tables first: refuses anything that is not a local database, except the
// hosts listed in TEST_DATABASE_ALLOWED_HOSTS (CI puts the Postgres service name there).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  console.error('TEST_DATABASE_URL manquante (voir .env.example).');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Refus : le jeu de démo vide les tables, interdit en production.');
  process.exit(1);
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];
const allowedHosts = (process.env.TEST_DATABASE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((allowed) => allowed.trim())
  .filter(Boolean);

const host = new URL(connectionString).hostname;
if (![...LOCAL_HOSTS, ...allowedHosts].includes(host)) {
  console.error(`Refus : l'hôte « ${host} » n'est pas une base locale.`);
  process.exit(1);
}

const sql = await readFile(
  fileURLToPath(new URL('../../db/demo-data.sql', import.meta.url)),
  'utf8',
);

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Jeu de démonstration chargé.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
