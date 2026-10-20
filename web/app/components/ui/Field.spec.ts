import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiField from './Field.vue'

describe('UiField', () => {
  it('associe le libellé au champ', async () => {
    const wrapper = await mountSuspended(UiField, { props: { id: 'pseudo', label: 'Pseudo' } })

    expect(wrapper.get('label').attributes('for')).toBe('pseudo')
    expect(wrapper.get('input').attributes('id')).toBe('pseudo')
  })

  it('émet la valeur saisie', async () => {
    const wrapper = await mountSuspended(UiField, { props: { id: 'pseudo', label: 'Pseudo' } })

    await wrapper.get('input').setValue('ryan')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['ryan'])
  })

  it("relie l'aide au champ pour les lecteurs d'écran", async () => {
    const wrapper = await mountSuspended(UiField, {
      props: { id: 'pseudo', label: 'Pseudo', hint: '3 à 20 caractères' },
    })

    expect(wrapper.get('input').attributes('aria-describedby')).toBe('pseudo-hint')
    expect(wrapper.get('#pseudo-hint').text()).toBe('3 à 20 caractères')
  })

  it('affiche le préfixe dans le cadre, sans le lire', async () => {
    const wrapper = await mountSuspended(UiField, {
      props: {
        id: 'pseudo',
        label: 'Pseudo',
        prefix: '@',
        inputAttributes: { maxlength: 30, autocomplete: 'off' },
      },
    })

    expect(wrapper.get('.field__prefix').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('input').attributes('maxlength')).toBe('30')
    expect(wrapper.get('input').attributes('autocomplete')).toBe('off')
  })

  it("remplace l'aide par l'erreur, annoncée et reliée au champ", async () => {
    const wrapper = await mountSuspended(UiField, {
      props: { id: 'pseudo', label: 'Pseudo', hint: 'Aide', error: 'Déjà pris' },
    })

    expect(wrapper.find('#pseudo-hint').exists()).toBe(false)
    expect(wrapper.get('#pseudo-error').attributes('role')).toBe('alert')
    expect(wrapper.get('#pseudo-error').text()).toBe('Déjà pris')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('pseudo-error')
  })
})
