import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { emptyWorkDraft } from '~/utils/admin'
import AdminWorkTextFields from './WorkTextFields.vue'

function mountFields() {
  const draft = reactive(emptyWorkDraft())
  return mountSuspended(AdminWorkTextFields, { props: { modelValue: draft } }).then((wrapper) => ({
    wrapper,
    draft,
  }))
}

describe('AdminWorkTextFields', () => {
  it('ajoute un titre alternatif international et le saisit', async () => {
    const { wrapper, draft } = await mountFields()

    await wrapper.findAll('[data-testid="row-list-add"]')[0]!.trigger('click')
    expect(draft.titles).toEqual([{ language: 'en', kind: 'international', title: '' }])
    await wrapper.get('input[id$="-title-0"]').setValue('Fictive Dawn')

    expect(draft.titles[0]!.title).toBe('Fictive Dawn')
  })

  it('ajoute un synopsis officiel en français et saisit son texte', async () => {
    const { wrapper, draft } = await mountFields()

    await wrapper.findAll('[data-testid="row-list-add"]')[1]!.trigger('click')
    expect(draft.synopses).toEqual([{ language: 'fr', source: 'official', text: '' }])
    await wrapper.get('textarea').setValue('Un résumé.')

    expect(draft.synopses[0]!.text).toBe('Un résumé.')
  })

  it('retire une ligne', async () => {
    const { wrapper, draft } = await mountFields()
    draft.titles.push({ language: 'en', kind: 'short', title: 'A' })
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="row-list-remove"]').trigger('click')

    expect(draft.titles).toEqual([])
  })
})
