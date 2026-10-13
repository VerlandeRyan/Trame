// Seule porte d'entrée des tests vers la base : jamais DATABASE_URL (base de dev, à ne pas vider).
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL manquante (voir .env.example)');
}

export const testDatabaseUrl: string = url;
