import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { AdminKind, ArchiveImpact } from '~/utils/admin'
import AdminArchiveConfirm from './ArchiveConfirm.vue'

const mountConfirm = (kind: AdminKind, impact?: ArchiveImpact | null) =>
  mountSuspended(AdminArchiveConfirm, { props: { modelValue: true, kind, impact } })

describe('AdminArchiveConfirm', () => {
  it('rappelle ce que l’archivage laisse en place pour une œuvre', async () => {
    const wrapper = await mountConfirm('works', { followers: 34, relations: 2 })

    const impact = wrapper.get('[data-testid="admin-archive-impact"]').text()
    expect(impact).toContain('34 membres')
    expect(impact).toContain('2 œuvres liées (conservées)')
  })

  it('n’affiche aucun récapitulatif sans information', async () => {
    const wrapper = await mountConfirm('people')

    expect(wrapper.find('[data-testid="admin-archive-impact"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('créditée sur une œuvre publiée')
  })

  it('est en rouge et émet la confirmation', async () => {
    const wrapper = await mountConfirm('works', null)
    const accept = wrapper.get('[data-testid="confirm-accept"]')

    expect(accept.classes()).toContain('btn--danger-solid')
    await accept.trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
