// Promeut le premier administrateur : `npm run db:promote-admin -- <handle>`
import pg from 'pg';

const handle = process.argv[2];
const connectionString = process.env.DATABASE_URL;
if (!handle) {
  console.error('Usage : npm run db:promote-admin -- <handle>');
  process.exit(1);
}
if (!connectionString) {
  console.error('DATABASE_URL manquante (voir .env.example).');
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  // Une seule requête : la promotion et la vérification « aucun admin » ne peuvent pas se croiser.
  const promoted = await client.query(
    `UPDATE app_user SET role = 'admin'
     WHERE handle = $1 AND deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM app_user WHERE role = 'admin' AND deleted_at IS NULL)
     RETURNING handle`,
    [handle],
  );
  if (promoted.rowCount === 1) {
    console.log(`${promoted.rows[0].handle} est maintenant administrateur.`);
  } else {
    const admin = await client.query(
      "SELECT 1 FROM app_user WHERE role = 'admin' AND deleted_at IS NULL",
    );
    console.log(
      admin.rowCount
        ? 'Aucune action : un administrateur existe déjà.'
        : `Aucune action : aucun compte actif avec le handle « ${handle} ».`,
    );
  }
} finally {
  await client.end();
}
