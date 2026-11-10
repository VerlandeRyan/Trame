/** Entry point of the database backup script: dumps the local working database, then prunes old archives. */
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

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const backupDir = process.env.BACKUP_DIR ?? '';
const service = process.env.BACKUP_SERVICE ?? 'db';
const database = process.env.POSTGRES_DB ?? '';
const user = process.env.POSTGRES_USER ?? '';

/** Streams a `pg_dump` of the database container into a file. */
async function dumpTo(filePath: string): Promise<void> {
  // Local development tool: `docker` is resolved from the PATH, as on the command line.
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

/** Deletes the archives outside the retention rules and returns their names. */
async function removeOldArchives(): Promise<string[]> {
  const toDelete = selectArchivesToDelete(await readdir(backupDir));
  await Promise.all(toDelete.map((name) => rm(path.join(backupDir, name))));
  return toDelete;
}

/** Writes today's archive (via a partial file, so a failed dump leaves nothing) and prunes the old ones. */
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
