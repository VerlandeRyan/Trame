import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import WorkCover from './Cover.vue'

describe('WorkCover', () => {
  it("affiche l'image fournie, sans trame", async () => {
    const wrapper = await mountSuspended(WorkCover, {
      props: { url: 'https://exemple.test/c.webp' },
    })

    expect(wrapper.get('img').attributes('src')).toBe('https://exemple.test/c.webp')
    expect(wrapper.classes()).toContain('cover--image')
  })

  it('affiche la pastille et la trame sans image', async () => {
    const wrapper = await mountSuspended(WorkCover)

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.classes()).toContain('cover--empty')
    expect(wrapper.find('.cover__pad').exists()).toBe(true)
  })

  it('applique la petite taille', async () => {
    const wrapper = await mountSuspended(WorkCover, { props: { size: 'small' } })

    expect(wrapper.classes()).toContain('cover--small')
  })
})
