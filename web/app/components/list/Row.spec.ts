import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { ListedEntry } from '~/utils/reading-list'
import ListRow from './Row.vue'

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
    startedOn: null,
    finishedOn: null,
  },
}

const mountRow = (item: ListedEntry = ITEM) =>
  mountSuspended(ListRow, { props: { item, counterKey: 0 } })

describe('ListRow', () => {
  it('affiche le titre (lien vers la fiche), le type, le format et la note', async () => {
    const wrapper = await mountRow()

    expect(wrapper.get('.row__link').attributes('href')).toBe('/work/4-aube-fictive')
    expect(wrapper.get('.row__kind').text()).toContain('Série')
    expect(wrapper.get('[data-testid="list-rating"]').text()).toBe('8 / 10')
  })

  it('affiche « — » sans note', async () => {
    const wrapper = await mountRow({ ...ITEM, entry: { ...ITEM.entry, rating: null } })

    expect(wrapper.get('[data-testid="list-rating"]').text()).toBe('—')
    expect(wrapper.find('.row__rating-mobile').exists()).toBe(false)
  })

  it('indique le total paru connu de chaque compteur, ou « sur ? »', async () => {
    const wrapper = await mountRow()

    expect(wrapper.get('[data-testid="list-chapters"] .row__total').text()).toBe('sur 86')
    expect(wrapper.get('[data-testid="list-volumes"] .row__total').text()).toBe('sur ?')
  })

  it('émet le chapitre ou le tome modifié, indépendamment', async () => {
    const wrapper = await mountRow()

    await wrapper.get('[aria-label="Augmenter : Chapitres"]').trigger('click')
    await wrapper.get('[aria-label="Augmenter : Tomes"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([[{ chaptersRead: 13 }], [{ volumesRead: 3 }]])
  })

  it('émet le changement de statut', async () => {
    const wrapper = await mountRow()
    await wrapper.get('[data-testid="list-status"]').trigger('click')

    await wrapper.get('[data-testid="list-status-completed"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([[{ status: 'completed' }]])
  })

  it('ouvre la fenêtre de modification', async () => {
    const wrapper = await mountRow()

    await wrapper.get('[data-testid="list-edit"]').trigger('click')

    expect(wrapper.emitted('edit')).toHaveLength(1)
  })
})
