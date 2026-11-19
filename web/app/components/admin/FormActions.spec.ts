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

  it('propose « Publier » pour une nouvelle fiche ou un brouillon, pas pour une fiche publiée', async () => {
    const published = await mountSuspended(AdminFormActions, { props: { saving: false } })
    expect(published.find('[data-testid="admin-publish"]').exists()).toBe(false)
    expect(published.get('[data-testid="admin-save"]').text()).toBe('Enregistrer')

    const creating = await mountSuspended(AdminFormActions, {
      props: { saving: false, mode: 'create' },
    })
    expect(creating.get('[data-testid="admin-save"]').text()).toBe('Enregistrer en brouillon')
    await creating.get('[data-testid="admin-publish"]').trigger('click')
    expect(creating.emitted('publish')).toHaveLength(1)

    const draft = await mountSuspended(AdminFormActions, {
      props: { saving: false, mode: 'draft' },
    })
    expect(draft.get('[data-testid="admin-save"]').text()).toBe('Enregistrer')
    expect(draft.find('[data-testid="admin-publish"]').exists()).toBe(true)
  })

  it('annonce l’erreur et bloque l’envoi pendant l’enregistrement', async () => {
    const wrapper = await mountSuspended(AdminFormActions, {
      props: { saving: true, errorKey: 'admin.error.validation' },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('sont vides ou invalides')
    expect(wrapper.get('[data-testid="admin-save"]').attributes('disabled')).toBeDefined()
  })
})
