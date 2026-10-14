import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import guard from './component-gallery'

// Les middlewares Nuxt reçoivent la route d'arrivée et la route de départ.
const callGuard = () => (guard as (...args: unknown[]) => unknown)({}, {})

describe('garde de la galerie de composants', () => {
  let initialValue: boolean

  beforeEach(() => {
    initialValue = useRuntimeConfig().public.componentGallery
  })

  afterEach(() => {
    useRuntimeConfig().public.componentGallery = initialValue
  })

  it('laisse passer quand la galerie est activée', () => {
    useRuntimeConfig().public.componentGallery = true

    expect(callGuard()).toBeUndefined()
  })

  it('répond 404 quand la galerie est désactivée', () => {
    useRuntimeConfig().public.componentGallery = false

    expect(() => callGuard()).toThrow(expect.objectContaining({ statusCode: 404 }))
  })
})
