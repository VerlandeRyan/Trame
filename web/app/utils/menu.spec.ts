import { describe, expect, it } from 'vitest'
import { menuMaxHeight, MENU_PREFERRED_HEIGHT_PX, shouldOpenAbove } from './menu'

describe('menuMaxHeight', () => {
  it('garde la hauteur souhaitée quand la fenêtre a la place', () => {
    expect(menuMaxHeight(100, 1000)).toBe(MENU_PREFERRED_HEIGHT_PX)
  })

  it('se réduit à la place restante sous le bouton', () => {
    expect(menuMaxHeight(600, 800)).toBe(184)
  })

  it('garde au moins trois options, même contre le bas de l’écran', () => {
    expect(menuMaxHeight(780, 800)).toBe(132)
  })
})

describe('shouldOpenAbove', () => {
  const MENU_HEIGHT = 240

  it('ouvre vers le bas quand le menu tient sous le bouton', () => {
    expect(shouldOpenAbove({ top: 100, bottom: 140 }, 800, MENU_HEIGHT)).toBe(false)
  })

  it('ouvre vers le haut quand le bas de l’écran est trop court et le haut plus large', () => {
    expect(shouldOpenAbove({ top: 700, bottom: 740 }, 800, MENU_HEIGHT)).toBe(true)
  })

  it('reste vers le bas quand le haut n’offre pas plus de place', () => {
    expect(shouldOpenAbove({ top: 60, bottom: 100 }, 200, MENU_HEIGHT)).toBe(false)
  })
})
