import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { emptyWorkDraft, type PublicationGap } from '~/utils/admin'
import AdminWorkForm from './WorkForm.vue'

function mountForm(
  props: {
    errorKey?: string
    errorScope?: 'none' | 'title' | 'all'
    serverGaps?: PublicationGap[]
    saving?: boolean
  } = {},
) {
  const draft = reactive(emptyWorkDraft())
  const { errorScope = 'none', serverGaps = [], ...rest } = props
  return mountSuspended(AdminWorkForm, {
    props: {
      modelValue: draft,
      genres: [{ code: 'manga', category: 'format' }],
      search: vi.fn(async () => []),
      saving: false,
      flagged: { scope: errorScope, serverGaps },
      ...rest,
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
    /** Fills everything a published work needs. */
    const fillRequired = (draft: ReturnType<typeof emptyWorkDraft>) => {
      draft.title = 'Aube Fictive'
      draft.genres = ['manga']
      draft.synopses.push({ language: 'fr', source: 'official', text: 'Résumé.' })
      draft.credits.push({ person: { id: 1, label: 'Léa' }, role: 'story' })
      draft.publishers.push({ publisher: { id: 2, label: 'Maison' } })
    }

    it('marque l’onglet « Informations », le titre et le format vides', async () => {
      const { wrapper } = await mountForm({ errorScope: 'all' })

      expect(alertedTabs(wrapper)).toContain('Informations')
      expect(wrapper.get('#work-title').attributes('aria-invalid')).toBe('true')
      expect(wrapper.text()).toContain('Champ obligatoire')
      expect(wrapper.text()).toContain('Choisis au moins un format.')
    })

    it('signale un manque que seule l’API voit, dans son onglet et sur son champ', async () => {
      const { wrapper, draft } = await mountForm({
        errorScope: 'all',
        serverGaps: ['synopses', 'credits', 'publisherIds'],
      })
      fillRequired(draft)
      await wrapper.vm.$nextTick()

      expect(alertedTabs(wrapper)).toEqual(['Titres et synopsis', 'Auteurs et éditeurs'])
      expect(wrapper.text()).toContain('Écris un synopsis dans la langue originale')
      expect(wrapper.text()).toContain('Ajoute au moins un auteur.')
      expect(wrapper.text()).toContain('Ajoute au moins un éditeur')
    })

    it('signale le format quand l’API le dit manquant, même si la saisie en a un', async () => {
      const { wrapper, draft } = await mountForm({ errorScope: 'all', serverGaps: ['genres'] })
      fillRequired(draft)
      await wrapper.vm.$nextTick()

      expect(alertedTabs(wrapper)).toEqual(['Informations'])
      expect(wrapper.text()).toContain('Choisis au moins un format.')
    })

    it('exige un auteur, un éditeur et un synopsis dans la langue originale pour publier', async () => {
      const { wrapper, draft } = await mountForm({ errorScope: 'all' })
      draft.title = 'Aube Fictive'
      draft.genres = ['manga']
      draft.synopses.push({ language: 'en', source: 'official', text: 'Summary.' })
      await wrapper.vm.$nextTick()

      expect(alertedTabs(wrapper)).toEqual(['Titres et synopsis', 'Auteurs et éditeurs'])
      expect(wrapper.text()).toContain('Écris un synopsis dans la langue originale')
      expect(wrapper.text()).toContain('Ajoute au moins un auteur.')
      expect(wrapper.text()).toContain('Ajoute au moins un éditeur')
    })

    it('après un brouillon refusé, ne signale que le titre, pas le format ni les lignes', async () => {
      const { wrapper, draft } = await mountForm({ errorScope: 'title' })
      draft.links.push({ kind: 'read', url: '', label: '' })
      await wrapper.vm.$nextTick()

      expect(alertedTabs(wrapper)).toEqual(['Informations'])
      expect(wrapper.get('#work-title').attributes('aria-invalid')).toBe('true')
      expect(wrapper.text()).not.toContain('Choisis au moins un format.')
      expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(1)
    })

    it('marque aussi « Titres et synopsis » et « Liens » quand une ligne a un champ obligatoire vide', async () => {
      const { wrapper, draft } = await mountForm({ errorScope: 'all' })
      fillRequired(draft)
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
      const { wrapper, draft } = await mountForm({ errorScope: 'all' })
      fillRequired(draft)
      await wrapper.vm.$nextTick()

      expect(alertedTabs(wrapper)).toEqual([])
      expect(wrapper.text()).not.toContain('Champ obligatoire')
    })

    it('marque l’onglet et le champ de la ligne dont la fiche n’est pas choisie', async () => {
      const { wrapper, draft } = await mountForm({ errorScope: 'all' })
      fillRequired(draft)
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
