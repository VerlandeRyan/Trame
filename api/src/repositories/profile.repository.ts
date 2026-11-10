/** Queries behind public member profiles: account, reading figures, top rated and recent updates. */
import { sql } from 'kysely';
import type { Db, ProfileVisibility } from '../db/database.js';
import {
  LISTED_ENTRY_COLUMNS,
  toListedEntry,
  zeroStatusCounts,
  type LibraryEntry,
  type StatusCounts,
} from './library.repository.js';
import type { WorkSummary } from './work.repository.js';
import { displayTitle, visibleWork, workSummaryColumns } from './work-sql.js';

/** Account data shown on a profile. */
export interface ProfileAccount {
  id: number;
  handle: string;
  visibility: ProfileVisibility;
  memberSince: Date;
}

/** Raw sums: the service computes the average rating. */
export interface ProfileFigures {
  statusCounts: StatusCounts;
  chaptersRead: number;
  volumesRead: number;
  ratingSum: number;
  ratingCount: number;
}

/** A rated work of a member. */
export interface ProfileRatedWork {
  work: WorkSummary;
  rating: number;
}

/** A recently updated reading-list entry. */
export interface RecentUpdate {
  work: WorkSummary;
  entry: LibraryEntry;
  updatedAt: Date;
}

/** Profile queries. */
export interface ProfileRepository {
  /** Active account; `null` if it does not exist or was deleted. The handle ignores case. */
  findByHandle(handle: string): Promise<ProfileAccount | null>;
  /** Reading totals of a member (archived works excluded). */
  figures(userId: number): Promise<ProfileFigures>;
  /** Rated works, best rating first (then most recent); archived works excluded. */
  topRated(userId: number, lang: string | undefined, limit: number): Promise<ProfileRatedWork[]>;
  /** List entries, most recently modified first; archived works excluded. */
  recentUpdates(userId: number, lang: string | undefined, limit: number): Promise<RecentUpdate[]>;
  /** Changes who can see the profile. */
  setVisibility(userId: number, visibility: ProfileVisibility): Promise<void>;
}

/** Creates the profile repository. */
export function createProfileRepository(db: Db): ProfileRepository {
  /** Visible works of a member's list, with their summary columns. */
  const listedWorks = (userId: number, lang: string | undefined) =>
    db
      .selectFrom('library_entry')
      .innerJoin('work', 'work.id', 'library_entry.work_id')
      .where('library_entry.user_id', '=', userId)
      .where(visibleWork)
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
        .where(visibleWork)
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
      // `rating IS NOT NULL` does not narrow the type: the filter below does it without an assertion.
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
