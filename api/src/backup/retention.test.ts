import { describe, expect, it } from 'vitest';
import {
  archiveNameForDate,
  assertOutsideRepository,
  selectArchivesToDelete,
} from './retention.js';

describe('archiveNameForDate', () => {
  it('horodate le nom à la journée', () => {
    expect(archiveNameForDate(new Date(2026, 10, 4))).toBe('trame-2026-11-04.dump');
  });
});

describe('selectArchivesToDelete', () => {
  const day = (offset: number) => archiveNameForDate(new Date(2026, 10, 4 - offset));

  it('ne supprime rien quand il y a peu d’archives', () => {
    const names = [day(0), day(1), day(2)];
    expect(selectArchivesToDelete(names)).toEqual([]);
  });

  it('garde les 7 plus récentes et supprime les anciennes sans doublon de semaine', () => {
    // 10 jours consécutifs : du 26/10 (lundi) au 4/11 (mercredi).
    const names = Array.from({ length: 10 }, (_, offset) => day(offset));
    const deleted = selectArchivesToDelete(names);
    // Gardées : 4/11 → 29/10 (7 jours) + la plus récente de chaque semaine déjà couverte.
    // 28/10, 27/10 et 26/10 sont dans la semaine du 26/10, dont la plus récente (28/10) est gardée.
    expect(deleted.sort()).toEqual([day(8), day(9)].sort());
  });

  it('garde une archive par semaine sur les 4 dernières semaines', () => {
    const names = Array.from({ length: 60 }, (_, offset) => day(offset));
    const kept = names.filter((name) => !selectArchivesToDelete(names).includes(name));
    expect(kept).toHaveLength(7 + 4);
  });

  it('ignore les fichiers qui ne sont pas des archives', () => {
    const names = [...Array.from({ length: 12 }, (_, offset) => day(offset)), 'notes.txt'];
    expect(selectArchivesToDelete(names)).not.toContain('notes.txt');
  });
});

describe('assertOutsideRepository', () => {
  it('refuse un dossier vide', () => {
    expect(() => assertOutsideRepository('', '/depot')).toThrow(/BACKUP_DIR/);
  });

  it('refuse un dossier dans le dépôt', () => {
    expect(() => assertOutsideRepository('/depot/backups', '/depot')).toThrow(/dépôt/);
  });

  it('accepte un dossier hors dépôt', () => {
    expect(() => assertOutsideRepository('/cloud/trame', '/depot')).not.toThrow();
  });
});
