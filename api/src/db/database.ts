import { Kysely, PostgresDialect, type Generated } from 'kysely';
import pg from 'pg';

export type WorkType = 'serie' | 'oneshot' | 'webcomic' | 'recueil';
export type WorkStatus = 'a_venir' | 'en_cours' | 'termine' | 'en_pause' | 'abandonne';
export type CreditRole = 'scenario' | 'dessin' | 'couleur' | 'autre';
/** Importance d'un rôle pour l'affichage (0 = en premier). Exhaustif : ajouter un rôle ici est imposé par le compilateur. */
export const CREDIT_ROLE_RANK: Record<CreditRole, number> = { scenario: 0, dessin: 1, couleur: 2, autre: 3 };
export type RelationKind =
  | 'suite'
  | 'prequelle'
  | 'spin_off'
  | 'histoire_annexe'
  | 'adaptation'
  | 'version_alternative'
  | 'meme_univers'
  | 'contient'
  | 'autre';
export type PublisherKind = 'editeur' | 'plateforme' | 'auto';
export type ExternalLinkKind = 'lire' | 'acheter' | 'site' | 'reseau';

export interface WorkTable {
  id: Generated<number>;
  title: string;
  type: WorkType;
  status: WorkStatus;
  synopsis: string | null;
  chapters: number | null;
  volumes: number | null;
  /** Date calendaire `YYYY-MM-DD` (voir `createDb`). */
  started_on: string | null;
  ended_on: string | null;
  cover_path: string | null;
  cover_source_url: string | null;
  cover_consent: Generated<boolean>;
  deleted_at: Date | null;
}

export interface WorkTitleTable {
  work_id: number;
  title: string;
}

export interface WorkRelationTable {
  work_id: number;
  related_work_id: number;
  relation: RelationKind;
}

export interface PersonTable {
  id: Generated<number>;
  name: string;
  kind: 'personne' | 'collectif';
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
  label: string;
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

/**
 * Types des tables, ajoutés au fur et à mesure des dépôts qui en ont besoin.
 * La base reste la référence : `docs/modele-de-donnees.md` et `migrations/`.
 */
export interface Database {
  work: WorkTable;
  work_title: WorkTitleTable;
  work_relation: WorkRelationTable;
  person: PersonTable;
  work_credit: WorkCreditTable;
  publisher: PublisherTable;
  work_publisher: WorkPublisherTable;
  genre: GenreTable;
  work_genre: WorkGenreTable;
  external_link: ExternalLinkTable;
}

export type Db = Kysely<Database>;

const { INT8, DATE } = pg.types.builtins;

export function createDb(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    types: {
      getTypeParser: ((oid: number, format?: 'text' | 'binary') => {
        // Identifiants et compteurs bigint : des nombres (bien en deçà de 2^53).
        if (oid === INT8) return (value: string) => Number(value);
        // Dates calendaires : conservées en `YYYY-MM-DD`, sans décalage de fuseau.
        if (oid === DATE) return (value: string) => value;
        return pg.types.getTypeParser(oid, format);
      }) as typeof pg.types.getTypeParser,
    },
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
