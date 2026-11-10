/** Storage of the external links of a work or a person. */
import type { Transaction } from 'kysely';
import type { Database, ExternalLinkKind } from '../db/database.js';

/** An external link as stored. */
export interface ExternalLinkRecord {
  kind: ExternalLinkKind;
  url: string;
  label: string | null;
}

/** What the links belong to: a work or a person. */
type Owner = { workId: number } | { personId: number };

/** Replaces all the links of a work or a person, inside the current transaction. */
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
