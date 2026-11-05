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

type Request = <T>(path: string, options?: Record<string, unknown>) => Promise<T>

const PICKER_RESULTS = 8

/** Appels de `/admin/*` ; le cookie de session au rendu serveur est ajouté par `useApi()`. */
export function createAdminClient(request: Request) {
  const base = (kind: AdminKind) => `/admin/${kind}`

  /** `pageSize` : 1 suffit quand seul `total` intéresse (compteur d'un onglet). */
  const list = (query: AdminListQuery, pageSize = ADMIN_PAGE_SIZE) =>
    request<AdminPage<AdminListItem>>(base(query.kind), {
      query: toAdminApiQuery(query, pageSize),
    })

  const get = <T>(kind: AdminKind, id: number) => request<T>(`${base(kind)}/${id}`)

  const create = <T>(kind: AdminKind, body: unknown) =>
    request<T>(base(kind), { method: 'POST', body })

  const replace = <T>(kind: AdminKind, id: number, body: unknown) =>
    request<T>(`${base(kind)}/${id}`, { method: 'PUT', body })

  const archive = (kind: AdminKind, id: number) =>
    request<AdminListItem>(`${base(kind)}/${id}/archive`, { method: 'POST' })

  const restore = (kind: AdminKind, id: number) =>
    request<AdminListItem>(`${base(kind)}/${id}/restore`, { method: 'POST' })

  /** Premiers enregistrements actifs dont le nom contient `text`, pour un sélecteur. */
  async function search(kind: AdminKind, text: string): Promise<RecordRef[]> {
    const page = await request<AdminPage<AdminListItem>>(base(kind), {
      query: { q: text, scope: 'active', page: 1, pageSize: PICKER_RESULTS },
    })
    return page.items.map((item) => ({ id: item.id, label: itemLabel(item) }))
  }

  return { list, get, create, replace, archive, restore, search }
}

export type AdminClient = ReturnType<typeof createAdminClient>
