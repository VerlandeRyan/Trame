import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { ListedEntry, ListUnit } from '~/utils/reading-list'
import ListGridItem from './GridItem.vue'

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
    volumesRead: 0,
    rating: null,
    startedOn: null,
    finishedOn: null,
  },
}

const mountItem = (unit: ListUnit = 'chapters', item: ListedEntry = ITEM) =>
  mountSuspended(ListGridItem, { props: { item, unit } })

/** Un glissement du doigt : `pointerdown` puis `pointerup` décalé. */
async function swipe(wrapper: Awaited<ReturnType<typeof mountItem>>, deltaX: number, deltaY = 0) {
  const cover = wrapper.get('.grid-item__cover')
  await cover.trigger('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 })
  await cover.trigger('pointerup', {
    pointerType: 'touch',
    clientX: 100 + deltaX,
    clientY: 100 + deltaY,
  })
}

describe('ListGridItem', () => {
  it('affiche « Ch. lu/total » quand le total est connu, « Ch. lu » sinon', async () => {
    const known = await mountItem()
    expect(known.get('[data-testid="list-grid-badge"]').text()).toBe('Ch. 12/86')

    const unknown = await mountItem('volumes')
    expect(unknown.get('[data-testid="list-grid-badge"]').text()).toBe('T. 0')
  })

  it('fait −1 / +1 avec les boutons, sur le compteur choisi', async () => {
    const wrapper = await mountItem()
    await wrapper.get('[data-testid="list-grid-plus"]').trigger('click')
    await wrapper.get('[data-testid="list-grid-minus"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([[{ chaptersRead: 13 }], [{ chaptersRead: 11 }]])

    const volumes = await mountItem('volumes')
    await volumes.get('[data-testid="list-grid-plus"]').trigger('click')
    expect(volumes.emitted('change')).toEqual([[{ volumesRead: 1 }]])
  })

  it('désactive −1 à zéro', async () => {
    const wrapper = await mountItem('volumes')

    expect(wrapper.get('[data-testid="list-grid-minus"]').attributes('disabled')).toBeDefined()
  })

  it('glisser vers la gauche fait +1, vers la droite −1', async () => {
    const wrapper = await mountItem()

    await swipe(wrapper, -80)
    await swipe(wrapper, 80)

    expect(wrapper.emitted('change')).toEqual([[{ chaptersRead: 13 }], [{ chaptersRead: 11 }]])
  })

  it('la couverture suit le doigt, révèle « +1 » / « −1 », puis revient au relâchement', async () => {
    const wrapper = await mountItem()
    const cover = wrapper.get('.grid-item__cover')

    await cover.trigger('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 })
    await cover.trigger('pointermove', { pointerType: 'touch', clientX: 60, clientY: 100 })
    expect(wrapper.get('.grid-item__stage').attributes('style')).toContain('--drag-offset: -32px')
    expect(wrapper.get('[data-testid="list-grid-reveal"]').text()).toBe('+1')

    await cover.trigger('pointermove', { pointerType: 'touch', clientX: 140, clientY: 100 })
    expect(wrapper.get('[data-testid="list-grid-reveal"]').text()).toBe('−1')

    await cover.trigger('pointerup', { pointerType: 'touch', clientX: 140, clientY: 100 })
    expect(wrapper.get('.grid-item__stage').attributes('style')).toContain('--drag-offset: 0px')
    expect(wrapper.get('[data-testid="list-grid-reveal"]').text()).toBe('')
  })

  it('une annulation du geste remet la couverture en place sans rien changer', async () => {
    const wrapper = await mountItem()
    const cover = wrapper.get('.grid-item__cover')

    await cover.trigger('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 })
    await cover.trigger('pointermove', { pointerType: 'touch', clientX: 50, clientY: 100 })
    await cover.trigger('pointercancel')

    expect(wrapper.get('.grid-item__stage').attributes('style')).toContain('--drag-offset: 0px')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('ignore un geste court, un geste plutôt vertical et la souris', async () => {
    const wrapper = await mountItem()

    await swipe(wrapper, 10)
    await swipe(wrapper, 60, 80)
    const cover = wrapper.get('.grid-item__cover')
    await cover.trigger('pointerdown', { pointerType: 'mouse', clientX: 0, clientY: 0 })
    await cover.trigger('pointerup', { pointerType: 'mouse', clientX: 200, clientY: 0 })

    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('un glissement n’ouvre pas la fiche, un simple toucher si', async () => {
    const wrapper = await mountItem()
    await swipe(wrapper, 80)

    const swipedClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    wrapper.get('.grid-item__link').element.dispatchEvent(swipedClick)
    expect(swipedClick.defaultPrevented).toBe(true)

    // Le clic suivant n'est plus un glissement : le lien reprend la main.
    await wrapper.get('.grid-item__link').trigger('click')
    expect(wrapper.emitted('change')).toHaveLength(1)
  })
})
