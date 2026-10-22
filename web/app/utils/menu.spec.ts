import { describe, expect, it } from 'vitest'
import { shouldOpenAbove } from './menu'

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
