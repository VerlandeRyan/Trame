import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { emptyPersonDraft } from '~/utils/admin'
import AdminPersonForm from './PersonForm.vue'

function mountForm(props: { errorKey?: string; showErrors?: boolean; saving?: boolean } = {}) {
  const draft = reactive(emptyPersonDraft())
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

  it('après un refus pour champ vide, marque le nom et l’adresse de lien manquants', async () => {
    const { wrapper, draft } = await mountForm({ showErrors: true })
    draft.links.push({ kind: 'website', url: '', label: '' })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('#person-name').attributes('aria-invalid')).toBe('true')
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(2)
  })

  it('ne marque rien avant un refus', async () => {
    const { wrapper } = await mountForm()

    expect(wrapper.find('[aria-invalid="true"]').exists()).toBe(false)
  })

  it('désactive la validation du navigateur', async () => {
    const { wrapper } = await mountForm()

    expect(wrapper.get('form').attributes('novalidate')).toBeDefined()
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
