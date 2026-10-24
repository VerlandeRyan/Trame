import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { emptyWorkDraft } from '~/utils/admin'
import AdminWorkRelatedFields from './WorkRelatedFields.vue'

function mountFields(part: 'people' | 'relations') {
  const draft = reactive(emptyWorkDraft())
  const search = vi.fn(async () => [])
  return mountSuspended(AdminWorkRelatedFields, {
    props: { modelValue: draft, part, search },
  }).then((wrapper) => ({ wrapper, draft, search }))
}

describe('AdminWorkRelatedFields', () => {
  it('auteurs et éditeurs : ajoute une ligne de crédit et d’éditeur avec leurs valeurs par défaut', async () => {
    const { wrapper, draft } = await mountFields('people')

    const buttons = wrapper.findAll('[data-testid="row-list-add"]')
    expect(buttons).toHaveLength(2)
    for (const button of buttons) await button.trigger('click')

    expect(draft.credits).toEqual([{ person: null, role: 'story' }])
    expect(draft.publishers).toEqual([{ publisher: null }])
    expect(draft.relations).toEqual([])
  })

  it('relations : ajoute une œuvre liée en suite et rappelle la règle (RG-17)', async () => {
    const { wrapper, draft } = await mountFields('relations')

    await wrapper.get('[data-testid="row-list-add"]').trigger('click')

    expect(draft.relations).toEqual([{ work: null, relation: 'sequel' }])
    expect(wrapper.text()).toContain('Une seule relation principale')
    expect(wrapper.text()).not.toContain('Auteurs')
  })

  it('cherche dans le bon type de fiche', async () => {
    const { wrapper, draft, search } = await mountFields('people')
    draft.credits.push({ person: null, role: 'art' })
    draft.publishers.push({ publisher: null })
    await wrapper.vm.$nextTick()

    vi.useFakeTimers()
    const inputs = wrapper.findAll('[data-testid="picker-input"]')
    await inputs[0]!.setValue('lé')
    await inputs[1]!.setValue('ma')
    await vi.advanceTimersByTimeAsync(250)
    vi.useRealTimers()

    expect(search).toHaveBeenCalledWith('people', 'lé')
    expect(search).toHaveBeenCalledWith('publishers', 'ma')
  })
})
