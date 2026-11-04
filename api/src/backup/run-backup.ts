import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import {
  archiveNameForDate,
  assertOutsideRepository,
  selectArchivesToDelete,
} from './retention.js';

// Point d'entrée de `npm run db:backup` : sauvegarde de la base de travail du conteneur local.
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const backupDir = process.env.BACKUP_DIR ?? '';
const service = process.env.BACKUP_SERVICE ?? 'db';
const database = process.env.POSTGRES_DB ?? '';
const user = process.env.POSTGRES_USER ?? '';

async function dumpTo(filePath: string): Promise<void> {
  // Outil de développement local : `docker` vient du PATH du poste de Ryan, comme en ligne de commande.
  const dump = spawn(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    'docker',
    ['compose', 'exec', '-T', service, 'pg_dump', '-Fc', '-U', user, '-d', database],
    { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const exited = new Promise<void>((resolve, reject) => {
    dump.on('error', reject);
    dump.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`pg_dump a échoué (code ${code}).`)),
    );
  });
  await Promise.all([pipeline(dump.stdout, createWriteStream(filePath)), exited]);
}

async function removeOldArchives(): Promise<string[]> {
  const toDelete = selectArchivesToDelete(await readdir(backupDir));
  await Promise.all(toDelete.map((name) => rm(path.join(backupDir, name))));
  return toDelete;
}

async function main(): Promise<void> {
  assertOutsideRepository(backupDir, repositoryRoot);
  if (!database || !user) {
    throw new Error('POSTGRES_DB et POSTGRES_USER requis (voir .env.example).');
  }
  await mkdir(backupDir, { recursive: true });

  const archiveName = archiveNameForDate(new Date());
  const partialPath = path.join(backupDir, `${archiveName}.partial`);
  try {
    await dumpTo(partialPath);
    if ((await stat(partialPath)).size === 0) throw new Error('Archive vide.');
  } catch (error) {
    await rm(partialPath, { force: true });
    throw error;
  }
  await rename(partialPath, path.join(backupDir, archiveName));

  const removed = await removeOldArchives();
  console.log(
    `Sauvegarde ${archiveName} écrite ; ${removed.length} ancienne(s) archive(s) supprimée(s).`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
