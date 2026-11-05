import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { AdminKind, AdminListItem } from '~/utils/admin'
import AdminRowMenu from './RowMenu.vue'

const PUBLISHED: AdminListItem = { id: 4, archived: false, title: 'Aube Fictive' }
const ARCHIVED: AdminListItem = { id: 5, archived: true, title: 'Basalte' }

const mountMenu = (item: AdminListItem | null, kind: AdminKind = 'works') =>
  mountSuspended(AdminRowMenu, { props: { kind, item, modelValue: true } })

describe('AdminRowMenu', () => {
  it('titre la feuille du nom de la fiche et propose modifier et relations pour une œuvre', async () => {
    const wrapper = await mountMenu(PUBLISHED)

    expect(wrapper.get('h2').text()).toBe('Aube Fictive')
    expect(wrapper.get('[data-testid="admin-menu-edit"]').attributes('href')).toBe(
      '/admin/catalogue/works/4',
    )
    expect(wrapper.get('[data-testid="admin-menu-relations"]').attributes('href')).toBe(
      '/admin/catalogue/works/4?section=relations',
    )
  })

  it('n’offre pas « Relations » pour une personne', async () => {
    const wrapper = await mountMenu({ id: 7, archived: false, name: 'Léa Auteure' }, 'people')

    expect(wrapper.find('[data-testid="admin-menu-relations"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="admin-menu-edit"]').attributes('href')).toBe(
      '/admin/catalogue/people/7',
    )
  })

  it('demande l’archivage de la fiche et se ferme', async () => {
    const wrapper = await mountMenu(PUBLISHED)

    await wrapper.get('[data-testid="admin-menu-archive"]').trigger('click')

    expect(wrapper.emitted('archive')?.[0]).toEqual([PUBLISHED])
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('ne propose que « Restaurer » pour une archive et émet la fiche', async () => {
    const wrapper = await mountMenu(ARCHIVED)

    expect(wrapper.find('[data-testid="admin-menu-edit"]').exists()).toBe(false)
    await wrapper.get('[data-testid="admin-menu-restore"]').trigger('click')

    expect(wrapper.emitted('restore')?.[0]).toEqual([ARCHIVED])
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })
})
