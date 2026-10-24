import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { AdminKind, AdminListItem } from '~/utils/admin'
import AdminResourceRows from './ResourceRows.vue'

const WORKS: AdminListItem[] = [
  {
    id: 4,
    archived: false,
    title: 'Aube Fictive',
    type: 'series',
    status: 'ongoing',
    formats: ['manga'],
    mainAuthor: 'Léa Auteure',
    updatedAt: new Date().toISOString(),
    completeness: 75,
  },
  {
    id: 5,
    archived: true,
    title: 'Basalte',
    type: 'oneshot',
    status: 'completed',
    formats: [],
    mainAuthor: null,
    archivedAt: new Date().toISOString(),
    archivedBy: 'ryan',
    completeness: 0,
  },
]

const mountRows = (kind: AdminKind = 'works', items = WORKS) =>
  mountSuspended(AdminResourceRows, { props: { kind, items } })

describe('AdminResourceRows', () => {
  it('décrit une œuvre : type et format, auteur, statut, complétude', async () => {
    const wrapper = await mountRows()
    const [first] = wrapper.findAll('[data-testid="admin-row"]')

    expect(first!.get('a').attributes('href')).toBe('/admin/catalogue/works/4')
    expect(first!.text()).toContain('Série · Manga')
    expect(first!.text()).toContain('Léa Auteure')
    expect(first!.text()).toContain('En cours')
    expect(first!.text()).toContain('Modifiée aujourd')
    expect(first!.text()).toContain('75 %')
    expect(first!.get('[data-testid="admin-row-completeness"]').text()).toBe('Complétude : 75 %')
  })

  it('propose « Modifier » pour une fiche publiée et « Restaurer » pour une archive', async () => {
    const wrapper = await mountRows()
    const [published, archived] = wrapper.findAll('[data-testid="admin-row"]')

    expect(published!.get('[data-testid="admin-edit"]').attributes('href')).toBe(
      '/admin/catalogue/works/4',
    )
    expect(published!.find('[data-testid="admin-restore"]').exists()).toBe(false)
    expect(archived!.find('[data-testid="admin-edit"]').exists()).toBe(false)
    expect(archived!.text()).toContain('par @ryan')
    expect(archived!.text()).toContain('—')
  })

  it('émet la fiche à restaurer', async () => {
    const wrapper = await mountRows()

    await wrapper.get('[data-testid="admin-restore"]').trigger('click')

    expect(wrapper.emitted('restore')?.[0]).toEqual([WORKS[1]])
  })

  it('résume la fiche en une ligne pour le mobile', async () => {
    const wrapper = await mountRows()
    const [work] = wrapper.findAll('[data-testid="admin-row-summary"]')

    expect(work!.text()).toBe('Série · Manga · En cours')
  })

  it('ouvre les actions d’une œuvre par « ⋮ » : modifier, relations et liens', async () => {
    const wrapper = await mountRows()
    const [published] = wrapper.findAll('[data-testid="admin-row"]')

    await published!.get('[data-testid="admin-row-menu"]').trigger('click')

    expect(wrapper.get('h2').text()).toBe('Aube Fictive')
    expect(wrapper.get('[data-testid="admin-menu-edit"]').attributes('href')).toBe(
      '/admin/catalogue/works/4',
    )
    expect(wrapper.get('[data-testid="admin-menu-relations"]').attributes('href')).toBe(
      '/admin/catalogue/works/4?section=relations',
    )
  })

  it('archive depuis les actions, après confirmation', async () => {
    const wrapper = await mountRows()
    const [published] = wrapper.findAll('[data-testid="admin-row"]')

    await published!.get('[data-testid="admin-row-menu"]').trigger('click')
    await wrapper.get('[data-testid="admin-menu-archive"]').trigger('click')
    expect(wrapper.emitted('archive')).toBeUndefined()

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    expect(wrapper.emitted('archive')?.[0]).toEqual([WORKS[0]])
  })

  it('rappelle, comme sur la fiche, les membres et les relations d’une œuvre à archiver', async () => {
    const loadImpact = vi.fn(async () => ({ followers: 34, relations: 2 }))
    const wrapper = await mountSuspended(AdminResourceRows, {
      props: { kind: 'works' as AdminKind, items: WORKS, loadImpact },
    })
    const [published] = wrapper.findAll('[data-testid="admin-row"]')

    await published!.get('[data-testid="admin-row-menu"]').trigger('click')
    await wrapper.get('[data-testid="admin-menu-archive"]').trigger('click')
    await flushPromises()

    expect(loadImpact).toHaveBeenCalledWith(WORKS[0])
    const impact = wrapper.get('[data-testid="admin-archive-impact"]').text()
    expect(impact).toContain('34 membres')
    expect(impact).toContain('2 œuvres liées (conservées)')
  })

  it('archive quand même si le récapitulatif ne se charge pas', async () => {
    const loadImpact = vi.fn(async () => {
      throw new Error('indisponible')
    })
    const wrapper = await mountSuspended(AdminResourceRows, {
      props: { kind: 'works' as AdminKind, items: WORKS, loadImpact },
    })
    const [published] = wrapper.findAll('[data-testid="admin-row"]')

    await published!.get('[data-testid="admin-row-menu"]').trigger('click')
    await wrapper.get('[data-testid="admin-menu-archive"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    expect(wrapper.find('[data-testid="admin-archive-impact"]').exists()).toBe(false)
    expect(wrapper.emitted('archive')?.[0]).toEqual([WORKS[0]])
  })

  it('propose « Restaurer » dans les actions d’une archive', async () => {
    const wrapper = await mountRows()
    const [, archived] = wrapper.findAll('[data-testid="admin-row"]')

    await archived!.get('[data-testid="admin-row-menu"]').trigger('click')
    await wrapper.get('[data-testid="admin-menu-restore"]').trigger('click')

    expect(wrapper.find('[data-testid="admin-menu-edit"]').exists()).toBe(false)
    expect(wrapper.emitted('restore')?.[0]).toEqual([WORKS[1]])
  })

  it('décrit une personne : nature et nombre d’œuvres', async () => {
    const wrapper = await mountRows('people', [
      { id: 7, archived: false, name: 'Léa Auteure', kind: 'collective', activeWorkCount: 2 },
    ])

    expect(wrapper.text()).toContain('Léa Auteure')
    expect(wrapper.text()).toContain('Collectif')
    expect(wrapper.text()).toContain('2 œuvres')
    expect(wrapper.get('a').attributes('href')).toBe('/admin/catalogue/people/7')
  })
})
