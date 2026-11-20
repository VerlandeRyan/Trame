import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { emptyPublisherFormValues } from '~/utils/admin'
import AdminPublisherForm from './PublisherForm.vue'

function mountForm(props: { errorKey?: string; showErrors?: boolean; saving?: boolean } = {}) {
  const draft = reactive(emptyPublisherFormValues())
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

  it('après un refus, indique qu’un site mal formé doit être une adresse https complète', async () => {
    const { wrapper, draft } = await mountForm({ showErrors: true })
    draft.name = 'Maison Fictive'
    draft.url = 'maison.test'
    await wrapper.vm.$nextTick()

    expect(wrapper.get('#publisher-url').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Adresse invalide')
    expect(wrapper.get('#publisher-name').attributes('aria-invalid')).toBeUndefined()
  })

  it('le site est facultatif : vide, il n’est pas signalé', async () => {
    const { wrapper } = await mountForm({ showErrors: true })

    expect(wrapper.get('#publisher-url').attributes('aria-invalid')).toBeUndefined()
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
