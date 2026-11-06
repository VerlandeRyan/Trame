import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { COVER_SIZES, type CoverSize } from '~/utils/cover'
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

  it('sans taille, remplit son parent', async () => {
    const wrapper = await mountSuspended(WorkCover)

    expect(wrapper.classes().some((name) => /^cover--(sm|md|lg|xl|hero)$/.test(name))).toBe(false)
  })

  it.each(Object.keys(COVER_SIZES))('applique la taille %s', async (size) => {
    const wrapper = await mountSuspended(WorkCover, { props: { size: size as CoverSize } })

    expect(wrapper.classes()).toContain(`cover--${size}`)
  })

  it('affine le liseré des petites tailles seulement', async () => {
    const small = await mountSuspended(WorkCover, { props: { size: 'sm' } })
    const medium = await mountSuspended(WorkCover, { props: { size: 'md' } })
    const large = await mountSuspended(WorkCover, { props: { size: 'lg' } })

    expect(small.classes()).toContain('cover--compact')
    expect(medium.classes()).toContain('cover--compact')
    expect(large.classes()).not.toContain('cover--compact')
  })

  it('change de taille à partir de 768 px avec wideSize', async () => {
    const wrapper = await mountSuspended(WorkCover, { props: { size: 'lg', wideSize: 'xl' } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cover--lg', 'cover--wide-xl']))
  })

  it('garde les largeurs du SCSS identiques à COVER_SIZES', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/components/work/Cover.vue'), 'utf8')
    const declared = Object.fromEntries(
      [...source.matchAll(/'(\w+)': (\d+)px/g)].map(([, name, px]) => [name, Number(px)]),
    )

    expect(declared).toEqual(COVER_SIZES)
  })
})
