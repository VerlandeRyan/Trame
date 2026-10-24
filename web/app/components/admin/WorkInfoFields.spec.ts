import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { emptyWorkDraft } from '~/utils/admin'
import AdminWorkInfoFields from './WorkInfoFields.vue'

const GENRES = [
  { code: 'manga', category: 'format' },
  { code: 'webtoon', category: 'format' },
  { code: 'fantasy', category: 'theme' },
  { code: 'inconnu_code', category: 'theme' },
]

function mountFields(overrides: Partial<ReturnType<typeof emptyWorkDraft>> = {}) {
  const draft = reactive({ ...emptyWorkDraft(), ...overrides })
  return mountSuspended(AdminWorkInfoFields, {
    props: { modelValue: draft, genres: GENRES },
  }).then((wrapper) => ({ wrapper, draft }))
}

describe('AdminWorkInfoFields', () => {
  it('cache les totaux tant que l’œuvre est en cours (RG-18)', async () => {
    const { wrapper } = await mountFields({ status: 'ongoing' })

    expect(wrapper.find('#work-chapters').exists()).toBe(false)
    expect(wrapper.text()).toContain('restent vides')
  })

  it('montre les totaux d’une œuvre terminée et n’y laisse entrer que des chiffres', async () => {
    const { wrapper, draft } = await mountFields({ status: 'completed' })

    await wrapper.get('#work-chapters').setValue('8a6-')
    await wrapper.get('#work-volumes').setValue('1234567')

    expect(draft.chapters).toBe('86')
    expect(draft.volumes).toBe('12345')
    expect((wrapper.get('#work-chapters').element as HTMLInputElement).value).toBe('86')
  })

  it('saisit le titre, une langue en minuscules et les dates', async () => {
    const { wrapper, draft } = await mountFields()

    await wrapper.get('#work-title').setValue('Aube Fictive')
    await wrapper.get('#work-language').setValue('JA1p')
    await wrapper.get('#work-started').setValue('2020-01-01')

    expect(draft).toMatchObject({
      title: 'Aube Fictive',
      originalLanguage: 'jap',
      startedOn: '2020-01-01',
    })
  })

  it('interdit une date de fin avant le début', async () => {
    const { wrapper } = await mountFields({ startedOn: '2020-05-01' })

    expect(wrapper.get('#work-ended').attributes('min')).toBe('2020-05-01')
  })

  it('choisit le type et le statut par pastilles', async () => {
    const { wrapper, draft } = await mountFields()

    await wrapper.get('[data-testid="pill-oneshot"]').trigger('change')
    await wrapper.get('[data-testid="pill-completed"]').trigger('change')

    expect(draft).toMatchObject({ type: 'oneshot', status: 'completed' })
  })

  it('range les formats et les genres à part, sans perdre ceux de l’autre groupe', async () => {
    const { wrapper, draft } = await mountFields({ genres: ['fantasy'] })
    const legends = wrapper.findAll('legend').map((legend) => legend.text())

    expect(legends).toContain('Formats')
    expect(wrapper.find('label[for$="-input"]').text()).toBe('Genres')
    await wrapper.get('[data-testid="pill-manga"]').trigger('change')
    expect(draft.genres).toEqual(['fantasy', 'manga'])

    // Un genre se retire par sa pastille et s'ajoute par la recherche, sans toucher aux formats.
    await wrapper.get('[data-testid="tag-chosen"] button').trigger('click')
    expect(draft.genres).toEqual(['manga'])
    await wrapper.get('[data-testid="tag-input"]').setValue('inconnu')
    await wrapper.get('[data-testid="tag-option"]').trigger('click')
    expect(draft.genres).toEqual(['manga', 'inconnu_code'])
  })
})
