import { describe, expect, it, vi } from 'vitest'
import {
  PENDING_ADD_TTL_MS,
  rememberPendingAdd,
  tabStorage,
  takePendingAdd,
  type PendingAddStorage,
} from './pending-add'

/** In-memory storage; `broken` makes every call throw, like a blocked browser storage. */
function fakeStorage(broken = false): PendingAddStorage & { values: Map<string, string> } {
  const values = new Map<string, string>()
  const guard = () => {
    if (broken) throw new Error('storage blocked')
  }
  return {
    values,
    getItem: (key) => {
      guard()
      return values.get(key) ?? null
    },
    setItem: (key, value) => {
      guard()
      values.set(key, value)
    },
    removeItem: (key) => {
      guard()
      values.delete(key)
    },
  }
}

describe('pending add', () => {
  it('rend le titre mémorisé une seule fois', () => {
    const storage = fakeStorage()
    rememberPendingAdd(42, 1000, storage)

    expect(takePendingAdd(2000, storage)).toBe(42)
    expect(takePendingAdd(2000, storage)).toBeNull()
  })

  it('ne rend rien quand rien n’a été mémorisé', () => {
    expect(takePendingAdd(0, fakeStorage())).toBeNull()
  })

  it('ne fait rien sans stockage', () => {
    expect(() => rememberPendingAdd(42, 0, null)).not.toThrow()
    expect(takePendingAdd(0, null)).toBeNull()
  })

  it('oublie une intention trop ancienne, tout en la retirant', () => {
    const storage = fakeStorage()
    rememberPendingAdd(42, 0, storage)

    expect(takePendingAdd(PENDING_ADD_TTL_MS + 1, storage)).toBeNull()
    expect(storage.values.size).toBe(0)
  })

  it('garde une intention à la limite de la durée', () => {
    const storage = fakeStorage()
    rememberPendingAdd(42, 0, storage)

    expect(takePendingAdd(PENDING_ADD_TTL_MS, storage)).toBe(42)
  })

  it.each([['pas du JSON'], ['null'], ['{"workId":"42","at":1}'], ['{"workId":42}']])(
    'ignore une valeur illisible : %s',
    (raw) => {
      const storage = fakeStorage()
      storage.setItem('trame.pending-add', raw)

      expect(takePendingAdd(5, storage)).toBeNull()
    },
  )

  it('donne le stockage de l’onglet, ou rien quand le navigateur le refuse', () => {
    expect(tabStorage()).toBe(window.sessionStorage)

    const blocked = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(tabStorage()).toBeNull()
    blocked.mockRestore()
  })

  it('ne casse pas quand le stockage est bloqué', () => {
    const storage = fakeStorage(true)

    expect(() => rememberPendingAdd(42, 0, storage)).not.toThrow()
    expect(takePendingAdd(0, storage)).toBeNull()
  })
})
