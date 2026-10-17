import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import HomeFeatured from './Featured.vue'
import type { FeaturedWork } from '~/utils/home'

const work = (
  id: number,
  title: string,
  synopsis: string | null = 'Résumé fictif.',
): FeaturedWork => ({
  id,
  title,
  originalTitle: title,
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  formats: ['manga'],
  coverPath: null,
  mainAuthor: 'Autrice Inventée',
  synopsis,
  recentAdditions: id === 1 ? 1 : 5,
})

const works = [work(1, 'Aube Fictive'), work(2, 'Brume Fictive'), work(3, 'Crépuscule Fictif')]

describe('HomeFeatured', () => {
  it('présente la première œuvre : badge, titre, ligne descriptive, synopsis et lien vers la fiche', async () => {
    const wrapper = await mountSuspended(HomeFeatured, { props: { works } })

    expect(wrapper.get('[data-testid="featured-title"]').text()).toBe('Aube Fictive')
    expect(wrapper.text()).toContain('Populaire cette semaine')
    expect(wrapper.text()).toContain('Autrice Inventée · Série · Manga · En cours')
    expect(wrapper.get('.featured__synopsis').text()).toBe('Synopsis : Résumé fictif.')
    expect(wrapper.get('[data-testid="featured-readers"]').text()).toBe(
      '1 lecteur l’a ajoutée cette semaine',
    )
    expect(wrapper.get('[data-testid="featured-open"]').attributes('href')).toBe(
      '/work/1-aube-fictive',
    )
    expect(wrapper.get('[data-testid="featured-slide"]').attributes('aria-label')).toBe(
      'Œuvre 1 sur 3',
    )
  })

  it('passe à l’œuvre suivante ou précédente en bouclant', async () => {
    const wrapper = await mountSuspended(HomeFeatured, { props: { works } })
    const title = () => wrapper.get('[data-testid="featured-title"]').text()

    await wrapper.get('[data-testid="featured-next"]').trigger('click')
    expect(title()).toBe('Brume Fictive')

    await wrapper.get('[data-testid="featured-prev"]').trigger('click')
    await wrapper.get('[data-testid="featured-prev"]').trigger('click')
    expect(title()).toBe('Crépuscule Fictif')
  })

  it('choisit une œuvre par sa pastille', async () => {
    const wrapper = await mountSuspended(HomeFeatured, { props: { works } })
    const dots = wrapper.findAll('[data-testid="featured-dot"]')

    await dots[2]!.trigger('click')

    expect(wrapper.get('[data-testid="featured-title"]').text()).toBe('Crépuscule Fictif')
    expect(dots[2]!.attributes('aria-current')).toBe('true')
    expect(dots[0]!.attributes('aria-current')).toBe('false')
  })

  it('donne à la transition le sens du changement : suite, retour, pastille en arrière', async () => {
    const wrapper = await mountSuspended(HomeFeatured, { props: { works } })
    const shift = () => wrapper.get('[data-testid="home-featured"]').attributes('style')

    await wrapper.get('[data-testid="featured-next"]').trigger('click')
    expect(shift()).toContain('--slide-shift: 24px')

    await wrapper.get('[data-testid="featured-prev"]').trigger('click')
    expect(shift()).toContain('--slide-shift: -24px')

    const dots = wrapper.findAll('[data-testid="featured-dot"]')
    await dots[2]!.trigger('click')
    expect(shift()).toContain('--slide-shift: 24px')
    await dots[0]!.trigger('click')
    expect(shift()).toContain('--slide-shift: -24px')
  })

  it('change d’œuvre au glissement du doigt : à gauche la suite, à droite le retour', async () => {
    const wrapper = await mountSuspended(HomeFeatured, { props: { works } })
    const stage = wrapper.get('[data-testid="featured-stage"]')
    const title = () => wrapper.get('[data-testid="featured-title"]').text()
    const swipe = async (from: number, to: number, pointerType = 'touch') => {
      await stage.trigger('pointerdown', { pointerType, clientX: from, clientY: 100 })
      await stage.trigger('pointerup', { pointerType, clientX: to, clientY: 104 })
    }

    await swipe(300, 150)
    await vi.waitFor(() => expect(title()).toBe('Brume Fictive'))
    expect(wrapper.get('[data-testid="home-featured"]').attributes('style')).toContain(
      '--slide-shift: 24px',
    )

    await swipe(100, 260)
    await vi.waitFor(() => expect(title()).toBe('Aube Fictive'))
    expect(wrapper.get('[data-testid="home-featured"]').attributes('style')).toContain(
      '--slide-shift: -24px',
    )
  })

  it('ignore la souris, un geste trop court et un geste annulé', async () => {
    const wrapper = await mountSuspended(HomeFeatured, { props: { works } })
    const stage = wrapper.get('[data-testid="featured-stage"]')

    await stage.trigger('pointerdown', { pointerType: 'mouse', clientX: 300, clientY: 100 })
    await stage.trigger('pointerup', { pointerType: 'mouse', clientX: 100, clientY: 100 })
    await stage.trigger('pointerdown', { pointerType: 'touch', clientX: 300, clientY: 100 })
    await stage.trigger('pointerup', { pointerType: 'touch', clientX: 280, clientY: 100 })
    await stage.trigger('pointerdown', { pointerType: 'touch', clientX: 300, clientY: 100 })
    await stage.trigger('pointercancel')
    await stage.trigger('pointerup', { pointerType: 'touch', clientX: 100, clientY: 100 })

    expect(wrapper.get('[data-testid="featured-title"]').text()).toBe('Aube Fictive')
  })

  it('ne change rien quand on choisit la pastille de l’œuvre déjà affichée', async () => {
    const wrapper = await mountSuspended(HomeFeatured, { props: { works } })
    const before = wrapper.get('[data-testid="home-featured"]').attributes('style')

    await wrapper.findAll('[data-testid="featured-dot"]')[0]!.trigger('click')

    expect(wrapper.get('[data-testid="featured-title"]').text()).toBe('Aube Fictive')
    expect(wrapper.get('[data-testid="home-featured"]').attributes('style')).toBe(before)
  })

  it('sans commandes ni pastilles pour une seule œuvre, et sans synopsis absent', async () => {
    const wrapper = await mountSuspended(HomeFeatured, {
      props: { works: [work(1, 'Aube Fictive', null)] },
    })

    expect(wrapper.find('[data-testid="featured-next"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="featured-dot"]').exists()).toBe(false)
    expect(wrapper.find('.featured__synopsis').exists()).toBe(false)
  })

  it('ne s’affiche pas sans œuvre', async () => {
    const wrapper = await mountSuspended(HomeFeatured, { props: { works: [] } })

    expect(wrapper.find('[data-testid="home-featured"]').exists()).toBe(false)
  })
})
