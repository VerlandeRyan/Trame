import { describe, expect, it, vi } from 'vitest'
import { parseAdminListQuery, type AdminListItem, type AdminPage } from './admin'
import { createAdminClient } from './admin-client'

function setup(respond: (path: string) => unknown = () => ({})) {
  const request = vi.fn(async (path: string) => respond(path))
  return { request, client: createAdminClient(request as never) }
}

const page = (items: AdminListItem[]): AdminPage<AdminListItem> => ({
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
})

describe('client d’administration', () => {
  it('liste avec la recherche, la portée et la page', async () => {
    const { client, request } = setup()
    await client.list(
      parseAdminListQuery({ kind: 'people', scope: 'archived', q: 'léa', page: '2' }),
    )
    expect(request).toHaveBeenCalledWith('/admin/people', {
      query: { q: 'léa', scope: 'archived', page: 2, pageSize: 20 },
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
})
