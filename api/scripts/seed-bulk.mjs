// Charge (ou retire avec `--remove`) db/demo-bulk.sql dans la base de travail (DATABASE_URL), en
// local uniquement. N'agit que sur les lignes « [Démo] » / « (démo) ».
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const remove = process.argv.includes('--remove');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL manquante (voir .env.example).');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Refus : jeu de démonstration interdit en production.');
  process.exit(1);
}

const host = new URL(connectionString).hostname;
if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) {
  console.error(`Refus : l'hôte « ${host} » n'est pas une base locale.`);
  process.exit(1);
}

const file = remove ? 'demo-bulk-remove.sql' : 'demo-bulk.sql';
const sql = await readFile(fileURLToPath(new URL(`../../db/${file}`, import.meta.url)), 'utf8');

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log(remove ? 'Jeu en volume retiré.' : 'Jeu en volume chargé (48 œuvres « [Démo] »).');
  if (!remove) {
    // Les identifiants changent à chaque chargement.
    const examples = await client.query(
      "SELECT id, title FROM work WHERE title IN ('[Démo] Brume Pâle 1', '[Démo] Havre Pâle 7') ORDER BY title",
    );
    for (const row of examples.rows) {
      console.log(`Fiche avec relations : /work/${row.id}  (${row.title})`);
    }
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
