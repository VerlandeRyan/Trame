import { Kysely, PostgresDialect, type ColumnType, type Generated } from 'kysely';
import pg from 'pg';

import type {
  CreditRole,
  ExternalLinkKind,
  GenreCategory,
  PersonKind,
  PublisherKind,
  RelationKind,
  SynopsisSource,
  TitleKind,
  WorkStatus,
  WorkType,
} from '../domain/catalogue-enums.js';

export type {
  CreditRole,
  ExternalLinkKind,
  GenreCategory,
  PersonKind,
  PublisherKind,
  RelationKind,
  SynopsisSource,
  TitleKind,
  WorkStatus,
  WorkType,
};

/** Importance d'un rôle pour l'affichage (0 = en premier). Exhaustif : ajouter un rôle ici est imposé par le compilateur. */
export const CREDIT_ROLE_RANK: Record<CreditRole, number> = {
  story: 0,
  art: 1,
  colors: 2,
  other: 3,
};

export interface WorkTable {
  id: Generated<number>;
  title: string;
  type: WorkType;
  status: WorkStatus;
  /** Langue originale (ISO 639) ; `title` est le titre dans cette langue. */
  original_language: string;
  chapters: number | null;
  volumes: number | null;
  /** Date calendaire `YYYY-MM-DD` (voir `createDb`). */
  started_on: string | null;
  ended_on: string | null;
  cover_path: string | null;
  cover_source_url: string | null;
  cover_consent: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
  deleted_by: number | null;
}

export interface WorkTitleTable {
  work_id: number;
  language: string;
  kind: TitleKind;
  title: string;
}

export interface WorkSynopsisTable {
  work_id: number;
  language: string;
  text: string;
  source: SynopsisSource;
}

export interface WorkRelationTable {
  work_id: number;
  related_work_id: number;
  relation: RelationKind;
}

export interface PersonTable {
  id: Generated<number>;
  name: string;
  kind: PersonKind;
  deleted_at: Date | null;
}

export interface WorkCreditTable {
  work_id: number;
  person_id: number;
  role: CreditRole;
}

export interface PublisherTable {
  id: Generated<number>;
  name: string;
  kind: PublisherKind;
  url: string | null;
  deleted_at: Date | null;
}

export interface WorkPublisherTable {
  work_id: number;
  publisher_id: number;
}

export interface GenreTable {
  id: Generated<number>;
  /** Slug stable en anglais ; le libellé est traduit côté front. */
  code: string;
  category: GenreCategory;
}

export interface WorkGenreTable {
  work_id: number;
  genre_id: number;
}

export interface ExternalLinkTable {
  id: Generated<number>;
  work_id: number | null;
  person_id: number | null;
  kind: ExternalLinkKind;
  url: string;
  label: string | null;
}

export const LIBRARY_STATUSES = [
  'reading',
  'completed',
  'plan_to_read',
  'on_hold',
  'dropped',
] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

export interface LibraryEntryTable {
  user_id: number;
  work_id: number;
  status: LibraryStatus;
  /** Chapitres lus, indépendants de `volumes_read` (jamais mappés ni additionnés). */
  chapters_read: Generated<number>;
  volumes_read: Generated<number>;
  /** Note donnée par le lecteur, de 1 à 10 ; `null` tant qu'il n'a pas noté. */
  rating: number | null;
  /** Dates calendaires `YYYY-MM-DD`. */
  started_on: string | null;
  finished_on: string | null;
  /** Date d'ajout à la liste. */
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

/** Journal en ajout seul : seule la colonne de valeur correspondant à `kind` est renseignée. */
export interface ReadingEventTable {
  id: Generated<number>;
  user_id: number;
  work_id: number;
  kind: 'chapters' | 'volumes' | 'status' | 'rating';
  chapters_added: number | null;
  volumes_added: number | null;
  new_status: LibraryStatus | null;
  new_rating: number | null;
  occurred_at: Generated<Date>;
}

export type UserRole = 'user' | 'admin';

export const PROFILE_VISIBILITIES = ['public', 'private'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export interface AppUserTable {
  id: Generated<number>;
  email: string;
  google_sub: string;
  /** citext, stocké en minuscules : 3 à 30 caractères `[a-z0-9_-]`. */
  handle: string;
  display_name: string | null;
  role: Generated<UserRole>;
  profile_visibility: Generated<ProfileVisibility>;
  created_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface SessionTable {
  sid: string;
  /** jsonb : sérialisé à l'écriture, déjà analysé à la lecture. */
  sess: ColumnType<unknown, string, string>;
  expire: Date;
}

/**
 * Types des tables, ajoutés au fur et à mesure des dépôts qui en ont besoin.
 * La base reste la référence : `docs/modele-de-donnees.md` et `migrations/`.
 */
export interface Database {
  work: WorkTable;
  work_title: WorkTitleTable;
  work_synopsis: WorkSynopsisTable;
  work_relation: WorkRelationTable;
  person: PersonTable;
  work_credit: WorkCreditTable;
  publisher: PublisherTable;
  work_publisher: WorkPublisherTable;
  genre: GenreTable;
  work_genre: WorkGenreTable;
  external_link: ExternalLinkTable;
  library_entry: LibraryEntryTable;
  reading_event: ReadingEventTable;
  app_user: AppUserTable;
  session: SessionTable;
}

export type Db = Kysely<Database>;

const { INT8, DATE } = pg.types.builtins;

export function createDb(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    types: {
      getTypeParser: ((oid: number, format?: 'text' | 'binary') => {
        // Identifiants et compteurs bigint : des nombres (bien en deçà de 2^53).
        if (oid === INT8) return Number;
        // Dates calendaires : conservées en `YYYY-MM-DD`, sans décalage de fuseau.
        if (oid === DATE) return (value: string) => value;
        return pg.types.getTypeParser(oid, format);
      }) as typeof pg.types.getTypeParser,
    },
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
