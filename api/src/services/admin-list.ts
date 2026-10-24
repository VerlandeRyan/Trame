import type { ArchiveScope } from '../repositories/admin-sql.js';

/** Paramètres communs aux listes d'administration. */
export interface AdminListInput {
  q?: string;
  scope: ArchiveScope;
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function pagination({ page, pageSize }: AdminListInput): { limit: number; offset: number } {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
