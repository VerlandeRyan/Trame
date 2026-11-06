import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMenuPlacement } from './useMenuPlacement'

describe('useMenuPlacement', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('place le menu sous le bouton quand rien ne le gêne', () => {
    const trigger = { top: 100, bottom: 140 }

    expect(useMenuPlacement()(trigger).isAbove).toBe(false)
  })

  it('ne compte pas l’en-tête collant dans la place au-dessus', () => {
    const header = document.createElement('header')
    header.className = 'layout-header'
    document.body.append(header)
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
      bottom: window.innerHeight,
    } as DOMRect)
    const trigger = { top: window.innerHeight - 50, bottom: window.innerHeight - 10 }

    expect(useMenuPlacement()(trigger).isAbove).toBe(false)
  })

  it('ouvre au-dessus quand le bas de la fenêtre est trop court', () => {
    const trigger = { top: window.innerHeight - 50, bottom: window.innerHeight - 10 }

    expect(useMenuPlacement()(trigger).isAbove).toBe(true)
  })
})
