import { describe, expect, it } from 'vitest'
import {
  menuMaxHeight,
  menuPlacement,
  MENU_PREFERRED_HEIGHT_PX,
  MENU_ROW_HEIGHT_PX,
  shouldOpenAbove,
} from './menu'

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

describe('menuPlacement', () => {
  it('ouvre vers le bas, à la hauteur voulue, quand la fenêtre a la place', () => {
    expect(menuPlacement({ top: 100, bottom: 140 }, 1000)).toEqual({
      isAbove: false,
      maxHeight: MENU_PREFERRED_HEIGHT_PX,
    })
  })

  it('reste vers le bas, en défilant, quand trois lignes y tiennent', () => {
    expect(menuPlacement({ top: 400, bottom: 440 }, 700)).toEqual({
      isAbove: false,
      maxHeight: 244,
    })
  })

  it('ouvre vers le haut quand le dessous ne montre pas trois lignes et que le dessus a plus de place', () => {
    expect(menuPlacement({ top: 700, bottom: 740 }, 800)).toEqual({
      isAbove: true,
      maxHeight: MENU_PREFERRED_HEIGHT_PX,
    })
    expect(menuPlacement({ top: 250, bottom: 290 }, 400)).toEqual({ isAbove: true, maxHeight: 234 })
  })

  it('reste vers le bas quand le dessus n’a pas plus de place', () => {
    expect(menuPlacement({ top: 60, bottom: 100 }, 200).isAbove).toBe(false)
  })

  it('ne compte pas l’en-tête collant dans la place au-dessus', () => {
    const trigger = { top: 100, bottom: 140 }

    expect(menuPlacement(trigger, 200).isAbove).toBe(true)
    expect(menuPlacement(trigger, 200, MENU_PREFERRED_HEIGHT_PX, 76).isAbove).toBe(false)
  })

  it('juge un menu court sur sa propre hauteur', () => {
    const trigger = { top: 500, bottom: 540 }
    const twoRows = 2 * MENU_ROW_HEIGHT_PX

    expect(menuPlacement(trigger, 660, twoRows).isAbove).toBe(false)
    expect(menuPlacement(trigger, 600, twoRows).isAbove).toBe(true)
  })
})
