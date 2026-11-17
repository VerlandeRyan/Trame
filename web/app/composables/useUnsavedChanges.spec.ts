import { describe, expect, it } from 'vitest'
import { useUnsavedChanges } from './useUnsavedChanges'

describe('useUnsavedChanges', () => {
  it('part de « rien à perdre » et partage son état entre les appelants', () => {
    const page = useUnsavedChanges()
    const menu = useUnsavedChanges()
    expect(page.value).toBe(false)

    page.value = true
    expect(menu.value).toBe(true)

    menu.value = false
    expect(page.value).toBe(false)
  })
})
