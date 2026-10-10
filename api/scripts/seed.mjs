// Charge db/demo-data.sql (jeu de démonstration fictif) dans la base locale.
// Le fichier vide d'abord les tables : refus sur tout ce qui n'est pas une base locale.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL manquante (voir .env.example).');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Refus : le jeu de démo vide les tables, interdit en production.');
  process.exit(1);
}

const host = new URL(connectionString).hostname;
if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) {
  console.error(`Refus : l'hôte « ${host} » n'est pas une base locale.`);
  process.exit(1);
}

const sql = await readFile(fileURLToPath(new URL('../../db/demo-data.sql', import.meta.url)), 'utf8');

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
