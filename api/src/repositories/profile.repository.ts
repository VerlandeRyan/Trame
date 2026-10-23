import { sql } from 'kysely';
import type { Db, ProfileVisibility } from '../db/database.js';
import {
  LISTED_ENTRY_COLUMNS,
  toListedEntry,
  zeroStatusCounts,
  type LibraryEntry,
  type StatusCounts,
} from './library.repository.js';
import { displayTitle, workSummaryColumns, type WorkSummary } from './work.repository.js';

export interface ProfileAccount {
  id: number;
  handle: string;
  visibility: ProfileVisibility;
  memberSince: Date;
}

/** Sommes brutes : la moyenne des notes est calculée par le service. */
export interface ProfileFigures {
  statusCounts: StatusCounts;
  chaptersRead: number;
  volumesRead: number;
  ratingSum: number;
  ratingCount: number;
}

export interface ProfileRatedWork {
  work: WorkSummary;
  rating: number;
}

export interface RecentUpdate {
  work: WorkSummary;
  entry: LibraryEntry;
  updatedAt: Date;
}

export interface ProfileRepository {
  /** Compte actif ; `null` s'il n'existe pas ou a été supprimé. Le handle ignore la casse. */
  findByHandle(handle: string): Promise<ProfileAccount | null>;
  figures(userId: number): Promise<ProfileFigures>;
  /** Œuvres notées, meilleure note d'abord (puis la plus récente) ; œuvres archivées exclues. */
  topRated(userId: number, lang: string | undefined, limit: number): Promise<ProfileRatedWork[]>;
  /** Entrées de la liste, la plus récemment modifiée d'abord ; œuvres archivées exclues. */
  recentUpdates(userId: number, lang: string | undefined, limit: number): Promise<RecentUpdate[]>;
  setVisibility(userId: number, visibility: ProfileVisibility): Promise<void>;
}

export function createProfileRepository(db: Db): ProfileRepository {
  const listedWorks = (userId: number, lang: string | undefined) =>
    db
      .selectFrom('library_entry')
      .innerJoin('work', 'work.id', 'library_entry.work_id')
      .where('library_entry.user_id', '=', userId)
      .where('work.deleted_at', 'is', null)
      .select(workSummaryColumns(displayTitle('work', lang)));

  return {
    async findByHandle(handle) {
      const row = await db
        .selectFrom('app_user')
        .select(['id', 'handle', 'profile_visibility', 'created_at'])
        .where('handle', '=', handle)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
      if (!row) return null;
      return {
        id: row.id,
        handle: row.handle,
        visibility: row.profile_visibility,
        memberSince: row.created_at,
      };
    },

    async figures(userId) {
      const rows = await db
        .selectFrom('library_entry')
        .innerJoin('work', 'work.id', 'library_entry.work_id')
        .where('library_entry.user_id', '=', userId)
        .where('work.deleted_at', 'is', null)
        .select([
          'library_entry.status',
          (eb) => eb.fn.countAll<number>().as('count'),
          sql<number>`COALESCE(SUM(library_entry.chapters_read), 0)::bigint`.as('chaptersRead'),
          sql<number>`COALESCE(SUM(library_entry.volumes_read), 0)::bigint`.as('volumesRead'),
          sql<number>`COALESCE(SUM(library_entry.rating), 0)::bigint`.as('ratingSum'),
          sql<number>`COUNT(library_entry.rating)::bigint`.as('ratingCount'),
        ])
        .groupBy('library_entry.status')
        .execute();

      const figures: ProfileFigures = {
        statusCounts: zeroStatusCounts(),
        chaptersRead: 0,
        volumesRead: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
      for (const row of rows) {
        figures.statusCounts[row.status] = row.count;
        figures.chaptersRead += row.chaptersRead;
        figures.volumesRead += row.volumesRead;
        figures.ratingSum += row.ratingSum;
        figures.ratingCount += row.ratingCount;
      }
      return figures;
    },

    async topRated(userId, lang, limit) {
      const rows = await listedWorks(userId, lang)
        .select('library_entry.rating')
        .where('library_entry.rating', 'is not', null)
        .orderBy('library_entry.rating', 'desc')
        .orderBy('library_entry.updated_at', 'desc')
        .orderBy('work.id')
        .limit(limit)
        .execute();
      // `rating IS NOT NULL` ne resserre pas le type : le filtre ci-dessous le fait sans assertion.
      return rows.flatMap(({ rating, ...work }) => (rating === null ? [] : [{ work, rating }]));
    },

    async recentUpdates(userId, lang, limit) {
      const rows = await listedWorks(userId, lang)
        .select([...LISTED_ENTRY_COLUMNS, 'library_entry.updated_at as updatedAt'])
        .orderBy('library_entry.updated_at', 'desc')
        .orderBy('work.id')
        .limit(limit)
        .execute();
      return rows.map(({ updatedAt, ...row }) => ({ ...toListedEntry(row), updatedAt }));
    },

    async setVisibility(userId, visibility) {
      await db
        .updateTable('app_user')
        .set({ profile_visibility: visibility })
        .where('id', '=', userId)
        .execute();
    },
  };
}
