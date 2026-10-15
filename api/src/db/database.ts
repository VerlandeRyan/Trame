import { Kysely, PostgresDialect, type Generated } from 'kysely';
import pg from 'pg';

/** Structure de l'histoire ; le format (manga, webtoon…) est dans la table `genre`. */
export type WorkType = 'series' | 'oneshot' | 'anthology';
export type WorkStatus = 'upcoming' | 'ongoing' | 'completed' | 'hiatus' | 'abandoned';
export type CreditRole = 'story' | 'art' | 'colors' | 'other';
/** Importance d'un rôle pour l'affichage (0 = en premier). Exhaustif : ajouter un rôle ici est imposé par le compilateur. */
export const CREDIT_ROLE_RANK: Record<CreditRole, number> = {
  story: 0,
  art: 1,
  colors: 2,
  other: 3,
};
export type RelationKind =
  | 'sequel'
  | 'prequel'
  | 'spin_off'
  | 'side_story'
  | 'adaptation'
  | 'alternate_version'
  | 'shared_universe'
  | 'contains'
  | 'other';
export type PublisherKind = 'publisher' | 'platform' | 'self_published';
export type ExternalLinkKind = 'read' | 'buy' | 'website' | 'social';
export type PersonKind = 'person' | 'collective';
/** `format` : manga, manhwa, bd, webtoon, webcomic… ; `theme` : fantasy, humor… */
export type GenreCategory = 'format' | 'theme';
export type TitleKind = 'translated' | 'international' | 'former' | 'short';
/** `official` (éditeur, auteur) > `human` (contributeur) > `machine` (traduction automatique). */
export type SynopsisSource = 'official' | 'human' | 'machine';

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
  deleted_at: Date | null;
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

export interface LibraryEntryTable {
  user_id: number;
  work_id: number;
  /** Note donnée par le lecteur, de 1 à 10 ; `null` tant qu'il n'a pas noté. */
  rating: number | null;
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
