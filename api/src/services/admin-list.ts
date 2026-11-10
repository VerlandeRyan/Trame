/** Types and pagination helper shared by the administration lists. */
import type { ArchiveScope } from '../repositories/admin-sql.js';

/** Parameters common to the administration lists. */
export interface AdminListInput {
  q?: string;
  scope: ArchiveScope;
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

/** Converts a page number and size into a SQL limit and offset. */
export function pagination({ page, pageSize }: AdminListInput): { limit: number; offset: number } {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
