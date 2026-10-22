import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { ListedEntry } from '~/utils/reading-list'
import ListEditModal from './EditModal.vue'

const ITEM: ListedEntry = {
  work: {
    id: 4,
    title: 'Aube Fictive',
    originalTitle: 'Aube Fictive',
    originalLanguage: 'fr',
    type: 'series',
    status: 'ongoing',
    formats: ['manga'],
    coverPath: null,
    mainAuthor: null,
    chapters: 86,
    volumes: null,
  },
  entry: {
    status: 'reading',
    chaptersRead: 12,
    volumesRead: 2,
    rating: 8,
    startedOn: '2026-09-02',
    finishedOn: null,
  },
}

/** Monte la fenêtre fermée puis l'ouvre : le brouillon se remplit à l'ouverture. */
async function mountOpened(item: ListedEntry | null = ITEM) {
  const wrapper = await mountSuspended(ListEditModal, {
    props: {
      item,
      modelValue: false,
      'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }),
    },
  })
  await wrapper.setProps({ modelValue: true })
  return wrapper
}

/** Ouvre le menu de la note et choisit une valeur (`0` : « — », pas de note). */
async function chooseRating(wrapper: Awaited<ReturnType<typeof mountOpened>>, value: string) {
  await wrapper.get('[data-testid="list-edit-rating"]').trigger('click')
  await wrapper.get(`[role="option"][data-value="${value}"]`).trigger('click')
}

describe('ListEditModal', () => {
  it('montre l’œuvre, ses totaux parus et les valeurs actuelles', async () => {
    const wrapper = await mountOpened()

    const text = wrapper.get('[data-testid="list-edit-modal"]').text()
    expect(text).toContain('Aube Fictive')
    expect(text).toContain('sur 86')
    expect(text).toContain('sur ?')
    expect((wrapper.get('input[type="date"]').element as HTMLInputElement).value).toBe('2026-09-02')
  })

  it('n’émet rien tant que rien n’a changé', async () => {
    const wrapper = await mountOpened()

    await wrapper.get('[data-testid="list-edit-save"]').trigger('click')

    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('n’émet que les champs modifiés, une date vidée effaçant la date', async () => {
    const wrapper = await mountOpened()
    await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')
    await chooseRating(wrapper, '7')
    await wrapper.get('input[type="date"]').setValue('')

    await wrapper.get('[data-testid="list-edit-save"]').trigger('click')

    expect(wrapper.emitted('save')).toEqual([[{ chaptersRead: 13, rating: 7, startedOn: null }]])
  })

  it('retire la note d’un seul choix, « — »', async () => {
    const wrapper = await mountOpened()
    await chooseRating(wrapper, '0')

    await wrapper.get('[data-testid="list-edit-save"]').trigger('click')

    expect(wrapper.emitted('save')).toEqual([[{ rating: null }]])
  })

  it('demande confirmation avant de retirer de la liste', async () => {
    const wrapper = await mountOpened()

    await wrapper.get('[data-testid="list-edit-remove"]').trigger('click')
    expect(wrapper.emitted('remove')).toBeUndefined()

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('ne rend rien sans œuvre', async () => {
    const wrapper = await mountOpened(null)

    expect(wrapper.find('[data-testid="list-edit-modal"]').exists()).toBe(false)
  })
})
