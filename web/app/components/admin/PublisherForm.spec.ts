import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { emptyPublisherDraft } from '~/utils/admin'
import AdminPublisherForm from './PublisherForm.vue'

function mountForm(props: { errorKey?: string; saving?: boolean } = {}) {
  const draft = emptyPublisherDraft()
  return mountSuspended(AdminPublisherForm, {
    props: { modelValue: draft, saving: false, ...props },
  }).then((wrapper) => ({ wrapper, draft }))
}

describe('AdminPublisherForm', () => {
  it('saisit le nom et le site dans le brouillon', async () => {
    const { wrapper, draft } = await mountForm()

    await wrapper.get('#publisher-name').setValue('Maison Fictive')
    await wrapper.get('#publisher-url').setValue('https://maison.test')

    expect(draft).toMatchObject({ name: 'Maison Fictive', url: 'https://maison.test' })
  })

  it('émet l’envoi du formulaire', async () => {
    const { wrapper } = await mountForm()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('annonce l’erreur de l’API et bloque l’envoi pendant l’enregistrement', async () => {
    const { wrapper } = await mountForm({ errorKey: 'error.ADMIN_REQUIRED', saving: true })

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="admin-save"]').attributes('disabled')).toBeDefined()
  })
})
