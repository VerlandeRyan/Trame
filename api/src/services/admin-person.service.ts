/** Business rules for administering people (creators). */
import { AppError } from '../errors.js';
import type {
  AdminPersonDraft,
  AdminPersonRecord,
  AdminPersonRepository,
  AdminPersonSummary,
} from '../repositories/admin-person.repository.js';
import { assertNotDraft, createDraftOperations } from './admin-draft.js';
import { pagination, type AdminListInput, type Page } from './admin-list.js';
import { refuseReplacement } from './admin-replace.js';

/** Data accepted to create a person. */
export type AdminPersonInput = AdminPersonDraft;

/** Data accepted to replace a person: `updatedAt` is the record version read before editing. */
export type AdminPersonReplacement = AdminPersonDraft & { updatedAt: string };

/** People administration operations. */
export interface AdminPersonService {
  list(input: AdminListInput): Promise<Page<AdminPersonSummary>>;
  get(id: number): Promise<AdminPersonRecord>;
  create(input: AdminPersonInput): Promise<AdminPersonRecord>;
  update(id: number, input: AdminPersonReplacement): Promise<AdminPersonRecord>;
  /** Refused while the person is credited on an unarchived work. */
  archive(id: number, adminId: number): Promise<AdminPersonRecord>;
  restore(id: number, adminId: number): Promise<AdminPersonRecord>;
  publish(id: number): Promise<AdminPersonRecord>;
  /** Only a draft or archived person no work credits (`NOT_REMOVABLE`, `RECORD_IN_USE`). */
  remove(id: number): Promise<void>;
  countDrafts(): Promise<number>;
}

/** Creates the people administration service. */
export function createAdminPersonService(repository: AdminPersonRepository): AdminPersonService {
  /** Reads a person, archived or not; throws when it does not exist. */
  async function get(id: number): Promise<AdminPersonRecord> {
    const person = await repository.find(id);
    if (!person) throw new AppError('NOT_FOUND');
    return person;
  }

  return {
    async list(input) {
      const { items, total } = await repository.list({
        q: input.q,
        scope: input.scope,
        state: input.state,
        ...pagination(input),
      });
      return { items, page: input.page, pageSize: input.pageSize, total };
    },

    get,

    async create(input) {
      return get(await repository.create(input));
    },

    async update(id, input) {
      const { updatedAt, ...draft } = input;
      if (!(await repository.update(id, draft, updatedAt))) await refuseReplacement(get, id);
      return get(id);
    },

    async archive(id, adminId) {
      const person = await get(id);
      if (person.archived) return person;
      assertNotDraft(person);
      if (!(await repository.setArchived(id, true, adminId))) {
        const { activeWorkCount } = await get(id);
        throw new AppError('PERSON_HAS_WORKS', { activeWorkCount });
      }
      return get(id);
    },

    async restore(id, adminId) {
      await get(id);
      await repository.setArchived(id, false, adminId);
      return get(id);
    },

    ...createDraftOperations(get, repository),

    countDrafts: () => repository.countDrafts(),
  };
}
