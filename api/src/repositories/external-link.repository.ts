import type { Transaction } from 'kysely';
import type { Database, ExternalLinkKind } from '../db/database.js';

export interface ExternalLinkRecord {
  kind: ExternalLinkKind;
  url: string;
  label: string | null;
}

type Owner = { workId: number } | { personId: number };

/** Remplace tous les liens d'une œuvre ou d'une personne, dans la transaction en cours. */
export async function replaceLinks(
  trx: Transaction<Database>,
  owner: Owner,
  links: ExternalLinkRecord[],
): Promise<void> {
  const ownerColumn = 'workId' in owner ? 'work_id' : 'person_id';
  const ownerId = 'workId' in owner ? owner.workId : owner.personId;
  await trx.deleteFrom('external_link').where(ownerColumn, '=', ownerId).execute();
  if (links.length === 0) return;
  await trx
    .insertInto('external_link')
    .values(
      links.map((link) => ({
        work_id: 'workId' in owner ? owner.workId : null,
        person_id: 'personId' in owner ? owner.personId : null,
        ...link,
      })),
    )
    .execute();
}
