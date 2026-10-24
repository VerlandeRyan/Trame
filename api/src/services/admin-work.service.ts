import type { WorkStatus, WorkType } from '../domain/catalogue-enums.js';
import { AppError } from '../errors.js';
import type {
  AdminWorkRecord,
  AdminWorkRepository,
  AdminWorkListItem,
  ArchivedReferences,
  MissingReferences,
  WorkDraft,
} from '../repositories/admin-work.repository.js';
import { pagination, type AdminListInput, type Page } from './admin-list.js';

/** `updatedAt` : la version de la fiche lue avant modification ; sans elle, rien n'est contrôlé. */
export type AdminWorkInput = WorkDraft & { updatedAt?: string };

export const ADMIN_WORK_SORTS = [
  'title',
  'title_desc',
  'completeness',
  'completeness_desc',
] as const;
export type AdminWorkSort = (typeof ADMIN_WORK_SORTS)[number];

/** Liste des œuvres : tri et filtres (une valeur d'un filtre suffit ; tous les filtres s'appliquent). */
export interface AdminWorkListInput extends AdminListInput {
  sort: AdminWorkSort;
  type?: WorkType[];
  status?: WorkStatus[];
  /** Codes de format. */
  format?: string[];
}

export interface AdminWorkService {
  list(input: AdminWorkListInput): Promise<Page<AdminWorkListItem>>;
  get(id: number): Promise<AdminWorkRecord>;
  create(input: AdminWorkInput): Promise<AdminWorkRecord>;
  update(id: number, input: AdminWorkInput): Promise<AdminWorkRecord>;
  /** Les entrées de liste des lecteurs sont conservées ; l'œuvre disparaît seulement du public. */
  archive(id: number, adminId: number): Promise<AdminWorkRecord>;
  restore(id: number, adminId: number): Promise<AdminWorkRecord>;
}

function hasAny(references: MissingReferences | ArchivedReferences): boolean {
  return Object.values(references).some((ids) => ids.length > 0);
}

/** Les fiches archivées que la fiche cite déjà restent permises : on ne les ajoute pas, on les garde. */
function newlyArchived(
  archived: ArchivedReferences,
  current?: AdminWorkRecord,
): ArchivedReferences {
  const without = (ids: number[], kept: number[]) => ids.filter((id) => !kept.includes(id));
  return {
    personIds: without(archived.personIds, current?.credits.map((c) => c.personId) ?? []),
    publisherIds: without(archived.publisherIds, current?.publisherIds ?? []),
    workIds: without(archived.workIds, current?.relations.map((r) => r.relatedWorkId) ?? []),
  };
}

export function createAdminWorkService(repository: AdminWorkRepository): AdminWorkService {
  async function get(id: number): Promise<AdminWorkRecord> {
    const work = await repository.find(id);
    if (!work) throw new AppError('NOT_FOUND');
    return work;
  }

  async function checkReferences(input: AdminWorkInput, current?: AdminWorkRecord): Promise<void> {
    if (input.relations.some((relation) => relation.relatedWorkId === current?.id)) {
      throw new AppError('INVALID_REFERENCE', { workIds: [current?.id] });
    }
    const missing = await repository.findMissingReferences(input);
    if (hasAny(missing)) throw new AppError('INVALID_REFERENCE', missing);
    const archived = newlyArchived(await repository.findArchivedReferences(input), current);
    if (hasAny(archived)) throw new AppError('ARCHIVED_REFERENCE', archived);
  }

  return {
    async list(input) {
      const { items, total } = await repository.list({
        q: input.q,
        scope: input.scope,
        sort: input.sort,
        types: input.type,
        statuses: input.status,
        formats: input.format,
        ...pagination(input),
      });
      return { items, page: input.page, pageSize: input.pageSize, total };
    },

    get,

    async create(input) {
      await checkReferences(input);
      return get(await repository.create(input));
    },

    async update(id, input) {
      await checkReferences(input, await get(id));
      const { updatedAt, ...draft } = input;
      if (!(await repository.update(id, draft, updatedAt))) throw new AppError('STALE_RECORD');
      return get(id);
    },

    async archive(id, adminId) {
      const work = await get(id);
      if (work.archived) return work;
      await repository.setArchived(id, true, adminId);
      return get(id);
    },

    async restore(id, adminId) {
      await get(id);
      await repository.setArchived(id, false, adminId);
      return get(id);
    },
  };
}
