/** Types and criteria helper shared by the administration lists. */
import type { AdminSort, LifecycleFilter } from '../repositories/admin-sql.js';

/** Parameters common to the administration lists. */
export interface AdminListInput {
  q?: string;
  lifecycle: LifecycleFilter;
  sort: AdminSort;
  page: number;
  pageSize: number;
}

/** One page of a paginated list, with the total number of matches. */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** The repository criteria common to the lists: search, lifecycle, sort and the SQL limit and offset of the page. */
export function listCriteria({ q, lifecycle, sort, page, pageSize }: AdminListInput) {
  return { q, lifecycle, sort, limit: pageSize, offset: (page - 1) * pageSize };
}
