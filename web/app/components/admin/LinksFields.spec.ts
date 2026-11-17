import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import AdminLinksFields from './LinksFields.vue'

type Links = { kind: string; url: string; label: string }[]

function mountLinks(
  links: Links,
  kinds: readonly ('read' | 'buy' | 'website' | 'social')[] = ['read', 'buy'],
) {
  return mountSuspended(AdminLinksFields, { props: { modelValue: reactive(links), kinds } })
}

describe('AdminLinksFields', () => {
  it('montre une ligne par lien avec son adresse', async () => {
    const wrapper = await mountLinks([{ kind: 'read', url: 'https://a.test', label: 'Lire' }])

    expect(wrapper.findAll('[data-testid="row-list-row"]')).toHaveLength(1)
    expect((wrapper.get('input[type="url"]').element as HTMLInputElement).value).toBe(
      'https://a.test',
    )
  })

  it('sans refus d’enregistrement, ne signale aucune adresse', async () => {
    const wrapper = await mountLinks([{ kind: 'read', url: 'exemple', label: '' }])

    expect(wrapper.find('[aria-invalid="true"]').exists()).toBe(false)
  })

  it('après un refus, distingue l’adresse vide de l’adresse mal formée', async () => {
    const wrapper = await mountSuspended(AdminLinksFields, {
      props: {
        modelValue: reactive([
          { kind: 'read', url: '', label: '' },
          { kind: 'read', url: 'exemple.test', label: '' },
          { kind: 'read', url: 'https://exemple.test', label: '' },
        ]),
        kinds: ['read', 'buy'],
        showErrors: true,
      },
    })

    const messages = wrapper.findAll('[role="alert"]').map((alert) => alert.text())
    expect(messages).toHaveLength(2)
    expect(messages[0]).toBe('Champ obligatoire')
    expect(messages[1]).toContain('Adresse invalide')
  })

  it('ajoute un lien du premier type autorisé, puis le retire', async () => {
    const links: Links = []
    const wrapper = await mountLinks(links, ['website', 'social'])

    await wrapper.get('[data-testid="row-list-add"]').trigger('click')
    expect(links).toEqual([{ kind: 'website', url: '', label: '' }])

    await wrapper.get('[data-testid="row-list-remove"]').trigger('click')
    expect(links).toEqual([])
  })

  it('ne propose que les types autorisés', async () => {
    const wrapper = await mountLinks([{ kind: 'read', url: '', label: '' }])

    await wrapper.get('[role="combobox"], .select__trigger').trigger('click')

    const options = wrapper.findAll('[role="option"]').map((option) => option.text())
    expect(options).toEqual(['Lire', 'Acheter'])
  })

  it('met à jour l’adresse saisie', async () => {
    const links: Links = [{ kind: 'read', url: '', label: '' }]
    const wrapper = await mountLinks(links)

    await wrapper.get('input[type="url"]').setValue('https://b.test')

    expect(links[0]!.url).toBe('https://b.test')
  })
})
