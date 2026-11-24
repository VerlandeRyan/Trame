/** Business rules for administering people (creators). */
import { AppError } from '../errors.js';
import type {
  AdminPersonCreateInput,
  AdminPersonDetail,
  AdminPersonRepository,
  AdminPersonListItem,
} from '../repositories/admin-person.repository.js';
import type { Namesakes } from '../repositories/admin-sql.js';
import { listCriteria, type AdminListInput, type Page } from './admin-list.js';
import { assertNotDraft, deleteRecord } from './admin-lifecycle.js';
import { refuseUpdate, type UpdateInput } from './admin-update.js';

export type { AdminPersonCreateInput };

/** Data sent to update a person (full replacement: every field is sent, `PUT`). */
export type AdminPersonUpdateInput = UpdateInput<AdminPersonCreateInput>;

/** People administration operations. */
export interface AdminPersonService {
  list(input: AdminListInput): Promise<Page<AdminPersonListItem>>;
  get(id: number): Promise<AdminPersonDetail>;
  create(input: AdminPersonCreateInput): Promise<AdminPersonDetail>;
  update(id: number, input: AdminPersonUpdateInput): Promise<AdminPersonDetail>;
  /** Refused while the person is credited on an unarchived work. */
  archive(id: number, adminId: number): Promise<AdminPersonDetail>;
  restore(id: number, adminId: number): Promise<AdminPersonDetail>;
  /** Only a draft or archived person no work credits (`NOT_REMOVABLE`, `RECORD_IN_USE`). */
  delete(id: number): Promise<void>;
  countDrafts(): Promise<number>;
  findNamesakes(name: string, excludeId?: number): Promise<Namesakes>;
}

/** Creates the people administration service. */
export function createAdminPersonService(repository: AdminPersonRepository): AdminPersonService {
  /** Reads a person, archived or not; throws when it does not exist. */
  async function get(id: number): Promise<AdminPersonDetail> {
    const person = await repository.find(id);
    if (!person) throw new AppError('NOT_FOUND');
    return person;
  }

  return {
    async list(input) {
      const { items, total } = await repository.list(listCriteria(input));
      return { items, page: input.page, pageSize: input.pageSize, total };
    },

    get,

    async create(input) {
      return get(await repository.create(input));
    },

    async update(id, input) {
      const { updatedAt, published, ...rest } = input;
      const fields = { ...rest, published: published === true };
      if (!(await repository.update(id, fields, updatedAt))) await refuseUpdate(get, id);
      return get(id);
    },

    async archive(id, adminId) {
      const person = await get(id);
      if (person.lifecycle === 'archived') return person;
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

    delete: (id) => deleteRecord(get, repository, id),

    countDrafts: () => repository.countDrafts(),

    findNamesakes: (name, excludeId) => repository.findNamesakes(name, excludeId),
  };
}
