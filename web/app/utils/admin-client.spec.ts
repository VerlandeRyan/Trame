import { describe, expect, it, vi } from 'vitest'
import { parseAdminListQuery, type AdminListItem, type AdminPage, type AdminWork } from './admin'
import { createAdminClient } from './admin-client'

function setup(respond: (path: string) => unknown = () => ({})) {
  const request = vi.fn(async (path: string) => respond(path))
  return { request, client: createAdminClient(request as never, { cookie: 'sid=1' }) }
}

const page = (items: AdminListItem[]): AdminPage<AdminListItem> => ({
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
})

describe('client d’administration', () => {
  it('liste avec la recherche, la portée, la page et le cookie du rendu serveur', async () => {
    const { client, request } = setup()
    await client.list(
      parseAdminListQuery({ kind: 'people', scope: 'archived', q: 'léa', page: '2' }),
    )
    expect(request).toHaveBeenCalledWith('/admin/people', {
      query: { q: 'léa', scope: 'archived', page: 2, pageSize: 20 },
      headers: { cookie: 'sid=1' },
    })
  })

  it('demande une page d’une seule fiche quand seul le total compte', async () => {
    const { client, request } = setup()
    await client.list(parseAdminListQuery({ scope: 'archived' }), 1)
    expect(request).toHaveBeenCalledWith(
      '/admin/works',
      expect.objectContaining({
        query: expect.objectContaining({ scope: 'archived', pageSize: 1 }),
      }),
    )
  })

  it('crée, remplace, archive et restaure', async () => {
    const { client, request } = setup()
    await client.create('works', { title: 'A' })
    await client.replace('publishers', 7, { name: 'M' })
    await client.archive('people', 3)
    await client.restore('people', 3)
    expect(request.mock.calls).toEqual([
      ['/admin/works', { method: 'POST', body: { title: 'A' } }],
      ['/admin/publishers/7', { method: 'PUT', body: { name: 'M' } }],
      ['/admin/people/3/archive', { method: 'POST' }],
      ['/admin/people/3/restore', { method: 'POST' }],
    ])
  })

  it('cherche parmi les fiches publiées pour un sélecteur', async () => {
    const { client, request } = setup(() =>
      page([
        { id: 1, archived: false, title: 'Aube' },
        { id: 2, archived: false, name: 'Léa' },
      ]),
    )
    expect(await client.search('works', 'a')).toEqual([
      { id: 1, label: 'Aube' },
      { id: 2, label: 'Léa' },
    ])
    expect(request).toHaveBeenCalledWith('/admin/works', {
      query: { q: 'a', scope: 'active', page: 1, pageSize: 8 },
    })
  })

  it('lit une fois chaque enregistrement cité pour en afficher le nom', async () => {
    const { client, request } = setup((path) => ({
      id: Number(path.split('/').pop()),
      archived: false,
      name: path,
    }))
    const work = {
      credits: [
        { personId: 2, role: 'story' },
        { personId: 2, role: 'art' },
      ],
      publisherIds: [3],
      relations: [{ relatedWorkId: 9, relation: 'sequel' }],
    } as AdminWork
    const labels = await client.loadLabels(work)
    expect(labels.people.get(2)).toBe('/admin/people/2')
    expect(labels.publishers.get(3)).toBe('/admin/publishers/3')
    expect(labels.works.get(9)).toBe('/admin/works/9')
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('se rabat sur `#id` quand un nom ne se lit pas, sans faire échouer les autres', async () => {
    const request = vi.fn(async (path: string) => {
      if (path.endsWith('/9')) throw new Error('indisponible')
      return { id: 2, archived: false, name: 'Léa' }
    })
    const client = createAdminClient(request as never)
    const work = {
      credits: [{ personId: 2, role: 'story' }],
      publisherIds: [] as number[],
      relations: [{ relatedWorkId: 9, relation: 'sequel' }],
    } as AdminWork
    const labels = await client.loadLabels(work)
    expect(labels.people.get(2)).toBe('Léa')
    expect(labels.works.get(9)).toBe('#9')
  })
})
