import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/database.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const server = createApp({ db }).listen(config.PORT, () => {
  console.log(`API à l'écoute sur le port ${config.PORT}`);
});

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function shutdown(): Promise<void> {
  try {
    await closeServer();
    await db.destroy();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  shutdown();
});
process.on('SIGINT', () => {
  shutdown();
});
