import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { emptyWorkDraft } from '~/utils/admin'
import AdminWorkForm from './WorkForm.vue'

function mountForm(props: { errorKey?: string; saving?: boolean } = {}) {
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

    expect(wrapper.get('[role="alert"]').text()).toContain('ne sont pas valides')
    expect(wrapper.get('[data-testid="admin-save"]').attributes('disabled')).toBeDefined()
  })
})
