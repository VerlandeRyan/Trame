import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { emptyPersonDraft } from '~/utils/admin'
import AdminPersonForm from './PersonForm.vue'

function mountForm(props: { errorKey?: string; saving?: boolean } = {}) {
  const draft = emptyPersonDraft()
  return mountSuspended(AdminPersonForm, {
    props: { modelValue: draft, saving: false, ...props },
  }).then((wrapper) => ({ wrapper, draft }))
}

describe('AdminPersonForm', () => {
  it('saisit le nom dans le brouillon', async () => {
    const { wrapper, draft } = await mountForm()

    await wrapper.get('#person-name').setValue('Léa Auteure')

    expect(draft.name).toBe('Léa Auteure')
  })

  it('émet l’envoi du formulaire', async () => {
    const { wrapper } = await mountForm()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('annonce l’erreur de l’API et bloque l’envoi pendant l’enregistrement', async () => {
    const { wrapper } = await mountForm({ errorKey: 'error.ADMIN_REQUIRED', saving: true })

    expect(wrapper.get('[role="alert"]').text()).toContain('réservée aux administrateurs')
    expect(wrapper.get('[data-testid="admin-save"]').attributes('disabled')).toBeDefined()
  })
})
