/** Client of the catalogue administration API (list, read, write, archive and search). */
import {
  ADMIN_PAGE_SIZE,
  itemLabel,
  toAdminApiQuery,
  type AdminKind,
  type AdminListItem,
  type AdminListQuery,
  type AdminPage,
  type RecordRef,
} from './admin'

/** The API call function the client is built on. */
type Request = <T>(path: string, options?: Record<string, unknown>) => Promise<T>

/** Number of results offered by a record picker. */
const PICKER_RESULTS = 8

/** Creates the administration client; the session cookie during server rendering is added by `useApi()`. */
export function createAdminClient(request: Request) {
  /** URL path of a resource kind. */
  const base = (kind: AdminKind) => `/admin/${kind}`

  /** `pageSize`: 1 is enough when only `total` matters (a tab counter). */
  const list = (query: AdminListQuery, pageSize = ADMIN_PAGE_SIZE) =>
    request<AdminPage<AdminListItem>>(base(query.kind), {
      query: toAdminApiQuery(query, pageSize),
    })

  /** Reads one record. */
  const get = <T>(kind: AdminKind, id: number) => request<T>(`${base(kind)}/${id}`)

  /** Creates a record. */
  const create = <T>(kind: AdminKind, body: unknown) =>
    request<T>(base(kind), { method: 'POST', body })

  /** Replaces a record. */
  const replace = <T>(kind: AdminKind, id: number, body: unknown) =>
    request<T>(`${base(kind)}/${id}`, { method: 'PUT', body })

  /** Archives a record. */
  const archive = (kind: AdminKind, id: number) =>
    request<AdminListItem>(`${base(kind)}/${id}/archive`, { method: 'POST' })

  /** Restores an archived record. */
  const restore = (kind: AdminKind, id: number) =>
    request<AdminListItem>(`${base(kind)}/${id}/restore`, { method: 'POST' })

  /** First active records whose name contains `text`, for a picker. */
  async function search(kind: AdminKind, text: string): Promise<RecordRef[]> {
    const page = await request<AdminPage<AdminListItem>>(base(kind), {
      query: { q: text, scope: 'active', page: 1, pageSize: PICKER_RESULTS },
    })
    return page.items.map((item) => ({ id: item.id, label: itemLabel(item) }))
  }

  return { list, get, create, replace, archive, restore, search }
}

/** The administration client. */
export type AdminClient = ReturnType<typeof createAdminClient>
