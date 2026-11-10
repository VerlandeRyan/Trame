/** Backup file naming and retention rules (which archives to keep or delete). */
import path from 'node:path';

/** Number of most recent daily archives kept. */
const DAILY_COUNT = 7;
/** Number of older weekly archives kept after the daily ones. */
const WEEKLY_COUNT = 4;
/** Archive file name, with the date captured as year, month, day. */
const ARCHIVE_PATTERN = /^trame-(\d{4})-(\d{2})-(\d{2})\.dump$/;
const MS_PER_DAY = 86_400_000;

/** Returns the archive file name for a given day. */
export function archiveNameForDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `trame-${date.getFullYear()}-${month}-${day}.dump`;
}

/** Throws unless the backup folder is set and outside the repository, so an archive never reaches git. */
export function assertOutsideRepository(backupDir: string, repositoryRoot: string): void {
  if (!backupDir) {
    throw new Error('BACKUP_DIR manquant (voir .env.example).');
  }
  const relative = path.relative(path.resolve(repositoryRoot), path.resolve(backupDir));
  const isInsideRepository = !relative.startsWith('..') && !path.isAbsolute(relative);
  if (isInsideRepository) {
    throw new Error('BACKUP_DIR doit être hors du dépôt.');
  }
}

/** Returns the Monday (in days since the epoch) of the week of an archive name. */
function weekKey(archiveName: string): number {
  const [, year, month, day] = ARCHIVE_PATTERN.exec(archiveName) ?? [];
  const days = Date.UTC(Number(year), Number(month) - 1, Number(day)) / MS_PER_DAY;
  const daysSinceMonday = (days + 3) % 7; // 1970-01-01 was a Thursday
  return days - daysSinceMonday;
}

/** Keeps the 7 newest archives, then the newest of each of the 4 following weeks; returns the rest. */
export function selectArchivesToDelete(fileNames: string[]): string[] {
  const archives = fileNames
    .filter((name) => ARCHIVE_PATTERN.test(name))
    .sort((a, b) => b.localeCompare(a));
  const kept = new Set(archives.slice(0, DAILY_COUNT));
  const newestOfWeek = new Map<number, string>();
  for (const name of archives.slice(DAILY_COUNT)) {
    const week = weekKey(name);
    if (!newestOfWeek.has(week)) newestOfWeek.set(week, name);
  }
  for (const name of [...newestOfWeek.values()].slice(0, WEEKLY_COUNT)) {
    kept.add(name);
  }
  return archives.filter((name) => !kept.has(name));
}
