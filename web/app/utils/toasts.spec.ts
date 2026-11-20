import { describe, expect, it } from 'vitest'
import {
  addToast,
  autoDismissDelay,
  MAX_TOASTS,
  removeActionToasts,
  removeToast,
  toastDismissDelay,
  type Toast,
} from './toasts'

function toast(id: number, overrides: Partial<Toast> = {}): Toast {
  return { id, tone: 'error', messageKey: `message.${id}`, ...overrides }
}

describe('addToast', () => {
  it('ajoute la nouvelle annonce après les précédentes', () => {
    expect(addToast([toast(1)], toast(2)).map((each) => each.id)).toEqual([1, 2])
  })

  it('ne garde que les plus récentes au-delà du maximum', () => {
    const full = Array.from({ length: MAX_TOASTS }, (_, index) => toast(index + 1))

    const result = addToast(full, toast(99))

    expect(result).toHaveLength(MAX_TOASTS)
    expect(result.at(-1)?.id).toBe(99)
    expect(result.some((each) => each.id === 1)).toBe(false)
  })

  it('remplace une annonce identique au lieu de l’empiler', () => {
    const first = toast(1, { messageKey: 'same' })
    const again = toast(2, { messageKey: 'same' })

    expect(addToast([first, toast(3)], again).map((each) => each.id)).toEqual([3, 2])
  })

  it('garde deux annonces de même texte mais de ton différent', () => {
    const info = toast(1, { tone: 'info', messageKey: 'same' })
    const error = toast(2, { tone: 'error', messageKey: 'same' })

    expect(addToast([info], error)).toHaveLength(2)
  })
})

describe('removeToast', () => {
  it('retire l’annonce demandée seulement', () => {
    expect(removeToast([toast(1), toast(2)], 1).map((each) => each.id)).toEqual([2])
  })

  it('ne change rien pour un identifiant inconnu', () => {
    expect(removeToast([toast(1)], 42)).toHaveLength(1)
  })
})

describe('removeActionToasts', () => {
  it('retire les annonces à « Réessayer » et garde les autres', () => {
    const toasts = [
      toast(1, { action: { kind: 'retry', run: () => undefined } }),
      toast(2),
      toast(3, { tone: 'success' }),
    ]

    expect(removeActionToasts(toasts).map((each) => each.id)).toEqual([2, 3])
  })

  it('retire aussi les annonces à « Annuler » : annuler appartient à l’écran qui l’a proposé', () => {
    const toasts = [
      toast(1, { tone: 'success', action: { kind: 'undo', run: () => undefined } }),
      toast(2, { tone: 'success' }),
    ]

    expect(removeActionToasts(toasts).map((each) => each.id)).toEqual([2])
  })

  it('rend la même liste quand aucune annonce n’est à retirer', () => {
    const toasts = [toast(1), toast(2)]

    expect(removeActionToasts(toasts)).toBe(toasts)
  })
})

describe('autoDismissDelay', () => {
  it('laisse une erreur affichée plus longtemps que les autres tons', () => {
    expect(autoDismissDelay('error')).toBe(10000)
  })

  it('efface une information ou une réussite au bout de quelques secondes', () => {
    expect(autoDismissDelay('info')).toBe(5000)
    expect(autoDismissDelay('success')).toBe(5000)
  })
})

describe('toastDismissDelay', () => {
  it('suit le ton d’une annonce ordinaire', () => {
    expect(toastDismissDelay(toast(1, { tone: 'error' }))).toBe(10000)
    expect(toastDismissDelay(toast(2, { tone: 'success' }))).toBe(5000)
  })

  it('ferme seule une annonce « Annuler » comme une réussite ordinaire', () => {
    const undo = toast(1, { tone: 'success', action: { kind: 'undo', run: () => undefined } })

    expect(toastDismissDelay(undo)).toBe(5000)
  })

  it('ne ferme jamais seule une annonce marquée durable', () => {
    expect(toastDismissDelay(toast(1, { tone: 'info', isSticky: true }))).toBeNull()
  })

  it('garde le délai d’une erreur « Réessayer »', () => {
    const retry = toast(1, { action: { kind: 'retry', run: () => undefined } })

    expect(toastDismissDelay(retry)).toBe(10000)
  })
})
