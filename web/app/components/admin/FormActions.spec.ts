import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminFormActions from './FormActions.vue'

describe('AdminFormActions', () => {
  it('propose d’enregistrer ou d’annuler, vers le catalogue', async () => {
    const wrapper = await mountSuspended(AdminFormActions, { props: { saving: false } })

    expect(wrapper.get('[data-testid="admin-save"]').attributes('type')).toBe('submit')
    expect(wrapper.get('[data-testid="admin-cancel"]').attributes('href')).toBe('/admin/catalogue')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('annonce l’erreur et bloque l’envoi pendant l’enregistrement', async () => {
    const wrapper = await mountSuspended(AdminFormActions, {
      props: { saving: true, errorKey: 'admin.error.validation' },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('ne sont pas valides')
    expect(wrapper.get('[data-testid="admin-save"]').attributes('disabled')).toBeDefined()
  })
})
