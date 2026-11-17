import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import UiToasts from './Toasts.vue'

enableAutoUnmount(afterEach)

afterEach(() => {
  const { toasts, dismiss } = useToasts()
  for (const toast of [...toasts.value]) dismiss(toast.id)
})

describe('UiToasts', () => {
  it("n'affiche rien sans annonce", async () => {
    const wrapper = await mountSuspended(UiToasts)

    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false)
  })

  it('annonce une erreur comme une alerte et une réussite comme un statut', async () => {
    const wrapper = await mountSuspended(UiToasts)
    const { show } = useToasts()

    show({ tone: 'error', messageKey: 'writeError.generic' })
    show({ tone: 'success', messageKey: 'auth.signedOut' })
    await nextTick()

    const [error, success] = wrapper.findAll('[data-testid="toast"]')
    expect(error?.attributes('role')).toBe('alert')
    expect(error?.classes()).toContain('toast--error')
    expect(error?.text()).toContain("Impossible d'enregistrer pour l'instant.")
    expect(success?.attributes('role')).toBe('status')
    expect(success?.classes()).toContain('toast--success')
  })

  it('propose « Réessayer » seulement quand une action est fournie, et la rejoue', async () => {
    const wrapper = await mountSuspended(UiToasts)
    const { show } = useToasts()
    const action = vi.fn()
    show({ tone: 'error', messageKey: 'writeError.generic', retry: action })
    show({ tone: 'info', messageKey: 'auth.signedOut' })
    await nextTick()

    expect(wrapper.findAll('[data-testid="toast-retry"]')).toHaveLength(1)
    await wrapper.get('[data-testid="toast-retry"]').trigger('click')

    expect(action).toHaveBeenCalledOnce()
    expect(wrapper.findAll('[data-testid="toast"]')).toHaveLength(1)
  })

  it('affiche la phrase de conseil sous le message, et règle la durée de la barre', async () => {
    const wrapper = await mountSuspended(UiToasts)
    const { show } = useToasts()
    show({ tone: 'error', messageKey: 'writeError.generic', hintKey: 'writeError.retryHint' })
    show({ tone: 'success', messageKey: 'auth.signedOut' })
    await nextTick()

    const [error, success] = wrapper.findAll('[data-testid="toast"]')
    expect(error?.get('.toast__hint').text()).toBe('Réessaie dans un instant.')
    expect(success?.find('.toast__hint').exists()).toBe(false)
    expect(error?.attributes('style')).toContain('--dismiss-duration: 10000ms')
    expect(success?.attributes('style')).toContain('--dismiss-duration: 5000ms')
  })

  it('se ferme avec la croix, nommée pour les lecteurs d’écran', async () => {
    const wrapper = await mountSuspended(UiToasts)
    useToasts().show({ tone: 'error', messageKey: 'writeError.generic' })
    await nextTick()

    const close = wrapper.get('button[aria-label="Fermer"]')
    await close.trigger('click')

    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false)
  })
})
