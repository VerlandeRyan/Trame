import path from 'node:path';

const DAILY_COUNT = 7;
const WEEKLY_COUNT = 4;
const ARCHIVE_PATTERN = /^trame-(\d{4})-(\d{2})-(\d{2})\.dump$/;
const MS_PER_DAY = 86_400_000;

export function archiveNameForDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `trame-${date.getFullYear()}-${month}-${day}.dump`;
}

// Le dossier doit rester hors du dépôt : une archive ne doit jamais pouvoir entrer dans git.
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

// Numéro de lundi (en jours depuis l'époque) de la semaine du nom d'archive.
function weekKey(archiveName: string): number {
  const [, year, month, day] = ARCHIVE_PATTERN.exec(archiveName) ?? [];
  const days = Date.UTC(Number(year), Number(month) - 1, Number(day)) / MS_PER_DAY;
  const daysSinceMonday = (days + 3) % 7; // le 1970-01-01 était un jeudi
  return days - daysSinceMonday;
}

// Garde les 7 archives les plus récentes, puis la plus récente de chacune des 4 semaines suivantes.
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
