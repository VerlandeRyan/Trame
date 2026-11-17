import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { emptyWorkDraft } from '~/utils/admin'
import AdminWorkForm from './WorkForm.vue'

function mountForm(props: { errorKey?: string; showErrors?: boolean; saving?: boolean } = {}) {
  const draft = reactive(emptyWorkDraft())
  return mountSuspended(AdminWorkForm, {
    props: {
      modelValue: draft,
      genres: [{ code: 'manga', category: 'format' }],
      search: vi.fn(async () => []),
      saving: false,
      ...props,
    },
  }).then((wrapper) => ({ wrapper, draft }))
}

// `v-show` masque une section par `display: none`.
const isHidden = (element: Element) => (element as HTMLElement).style.display === 'none'

const visibleSections = (wrapper: Awaited<ReturnType<typeof mountForm>>['wrapper']) =>
  wrapper
    .findAll('[role="tabpanel"]')
    .filter((section) => !isHidden(section.element))
    .map((section) => section.element.textContent ?? '')

const sectionOf = (wrapper: Awaited<ReturnType<typeof mountForm>>['wrapper'], selector: string) =>
  wrapper.get(selector).element.closest('[role="tabpanel"]')!

const alertedTabs = (wrapper: Awaited<ReturnType<typeof mountForm>>['wrapper']) =>
  wrapper
    .findAll('[role="tab"]')
    .filter((tab) => tab.find('.tabs__alert').exists())
    .map((tab) => tab.text())

// Le routeur est partagé entre les tests : chacun repart d'une adresse sans section.
beforeEach(async () => {
  await useRouter().replace('/')
})

describe('AdminWorkForm', () => {
  it('montre une seule section à la fois, les informations d’abord', async () => {
    const { wrapper } = await mountForm()

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Informations',
      'Titres et synopsis',
      'Relations',
      'Liens',
      'Auteurs et éditeurs',
    ])
    expect(visibleSections(wrapper)).toHaveLength(1)
    expect(isHidden(sectionOf(wrapper, '#work-title'))).toBe(false)
  })

  it('change de section, sans perdre ce qui a été saisi', async () => {
    const { wrapper, draft } = await mountForm()
    await wrapper.get('#work-title').setValue('Aube Fictive')

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')

    await vi.waitFor(() => expect(isHidden(sectionOf(wrapper, '#work-title'))).toBe(true))
    expect(draft.title).toBe('Aube Fictive')
    expect(visibleSections(wrapper)[0]).toContain('Titres alternatifs')
  })

  it('rouvre la section portée par l’adresse après un rechargement', async () => {
    const { wrapper } = await mountForm()

    await useRouter().push('/?section=links')

    await vi.waitFor(() => expect(visibleSections(wrapper)[0]).toContain('Liens'))
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Liens')
  })

  it('range la section choisie dans l’adresse, sans l’écrire pour la première', async () => {
    const { wrapper } = await mountForm()
    const tabs = wrapper.findAll('[role="tab"]')

    await tabs[3]!.trigger('click')
    await vi.waitFor(() => expect(useRoute().query.section).toBe('links'))

    await tabs[0]!.trigger('click')
    await vi.waitFor(() => expect(useRoute().query.section).toBeUndefined())
  })

  it('émet l’envoi du formulaire', async () => {
    const { wrapper } = await mountForm()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('annonce l’erreur de l’API et bloque l’envoi pendant l’enregistrement', async () => {
    const { wrapper } = await mountForm({ errorKey: 'admin.error.validation', saving: true })

    expect(wrapper.get('[role="alert"]').text()).toContain('sont vides ou invalides')
    expect(wrapper.get('[data-testid="admin-save"]').attributes('disabled')).toBeDefined()
  })

  describe('champs obligatoires et lignes incomplètes refusés à l’enregistrement', () => {
    it('marque l’onglet « Informations », le titre et le format vides', async () => {
      const { wrapper } = await mountForm({ showErrors: true })

      expect(alertedTabs(wrapper)).toEqual(['Informations'])
      expect(wrapper.get('#work-title').attributes('aria-invalid')).toBe('true')
      expect(wrapper.text()).toContain('Champ obligatoire')
      expect(wrapper.text()).toContain('Choisis au moins un format.')
    })

    it('marque aussi « Titres et synopsis » et « Liens » quand une ligne a un champ obligatoire vide', async () => {
      const { wrapper, draft } = await mountForm({ showErrors: true })
      draft.title = 'Aube Fictive'
      draft.genres = ['manga']
      draft.titles.push({ language: 'en', kind: 'international', title: '' })
      draft.synopses.push({ language: 'fr', source: 'official', text: ' ' })
      draft.links.push({ kind: 'read', url: '', label: '' })
      await wrapper.vm.$nextTick()

      expect(alertedTabs(wrapper)).toEqual(['Titres et synopsis', 'Liens'])
      expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(3)
      expect(wrapper.findAll('.texts__area--invalid')).toHaveLength(1)
    })

    it('désactive la validation du navigateur : seuls nos messages s’affichent', async () => {
      const { wrapper } = await mountForm()

      expect(wrapper.get('form').attributes('novalidate')).toBeDefined()
    })

    it('ne marque plus les champs remplis', async () => {
      const { wrapper, draft } = await mountForm({ showErrors: true })
      draft.title = 'Aube Fictive'
      draft.genres = ['manga']
      await wrapper.vm.$nextTick()

      expect(alertedTabs(wrapper)).toEqual([])
      expect(wrapper.text()).not.toContain('Champ obligatoire')
    })

    it('marque l’onglet et le champ de la ligne dont la fiche n’est pas choisie', async () => {
      const { wrapper, draft } = await mountForm({ showErrors: true })
      draft.title = 'Aube Fictive'
      draft.genres = ['manga']
      draft.publishers.push({ publisher: null })
      await wrapper.vm.$nextTick()

      expect(alertedTabs(wrapper)).toEqual(['Auteurs et éditeurs'])
      expect(wrapper.findAll('[data-testid="picker-error"]')).toHaveLength(1)
    })

    it('ne marque rien tant que l’enregistrement n’a pas été refusé', async () => {
      const { wrapper, draft } = await mountForm()
      draft.publishers.push({ publisher: null })
      await wrapper.vm.$nextTick()

      expect(alertedTabs(wrapper)).toEqual([])
      expect(wrapper.find('[data-testid="picker-error"]').exists()).toBe(false)
    })
  })
})
