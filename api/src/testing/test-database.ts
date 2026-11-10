/** The tests' only entry to the database: always the disposable test database, never the working one. */
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL manquante (voir .env.example)');
}

export const testDatabaseUrl: string = url;
