import {
  ADMIN_PAGE_SIZE,
  itemLabel,
  toAdminApiQuery,
  type AdminKind,
  type AdminListItem,
  type AdminListQuery,
  type AdminPage,
  type AdminWork,
  type RecordRef,
  type WorkLabels,
} from './admin'

type Request = <T>(path: string, options?: Record<string, unknown>) => Promise<T>

const PICKER_RESULTS = 8

/** Appels de `/admin/*` ; `headers` porte le cookie de session quand l'appel part du serveur. */
export function createAdminClient(request: Request, headers?: Record<string, string>) {
  const base = (kind: AdminKind) => `/admin/${kind}`

  /** `pageSize` : 1 suffit quand seul `total` intéresse (compteur d'un onglet). */
  const list = (query: AdminListQuery, pageSize = ADMIN_PAGE_SIZE) =>
    request<AdminPage<AdminListItem>>(base(query.kind), {
      query: toAdminApiQuery(query, pageSize),
      headers,
    })

  const get = <T>(kind: AdminKind, id: number) => request<T>(`${base(kind)}/${id}`, { headers })

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

  /** Noms des personnes, éditeurs et œuvres cités par une fiche (illisibles : repli sur `#id`). */
  async function loadLabels(work: AdminWork): Promise<WorkLabels> {
    const labelOf = async (kind: AdminKind, id: number): Promise<[number, string]> => {
      try {
        return [id, itemLabel(await get<AdminListItem>(kind, id))]
      } catch {
        return [id, `#${id}`]
      }
    }
    const labelsOf = async (kind: AdminKind, ids: number[]) =>
      new Map(await Promise.all([...new Set(ids)].map((id) => labelOf(kind, id))))
    const [people, publishers, works] = await Promise.all([
      labelsOf(
        'people',
        work.credits.map((credit) => credit.personId),
      ),
      labelsOf('publishers', work.publisherIds),
      labelsOf(
        'works',
        work.relations.map((relation) => relation.relatedWorkId),
      ),
    ])
    return { people, publishers, works }
  }

  return { list, get, create, replace, archive, restore, search, loadLabels }
}

export type AdminClient = ReturnType<typeof createAdminClient>
