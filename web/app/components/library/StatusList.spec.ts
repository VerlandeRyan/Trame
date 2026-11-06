import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import LibraryStatusList from './StatusList.vue'

type TriggerSlot = { isOpen: boolean; menuId: string; toggle: () => void }

const renderTrigger = ({ isOpen, menuId, toggle }: TriggerSlot) =>
  h(
    'button',
    {
      type: 'button',
      'data-testid': 'trigger',
      'aria-haspopup': 'menu',
      'aria-expanded': isOpen,
      'aria-controls': menuId,
      onClick: toggle,
    },
    'Statut',
  )

function mountList(options: { withFooter?: boolean; block?: boolean } = {}) {
  return mountSuspended(LibraryStatusList, {
    props: { status: 'reading', testidPrefix: 'demo', block: options.block },
    slots: {
      trigger: renderTrigger,
      ...(options.withFooter && {
        footer: ({ close }: { close: () => void }) =>
          h('button', { type: 'button', 'data-testid': 'demo-footer', onClick: close }, 'Pied'),
      }),
    },
    attachTo: document.body,
  })
}

const openMenu = (wrapper: Awaited<ReturnType<typeof mountList>>) =>
  wrapper.get('[data-testid="trigger"]').trigger('click')

describe('LibraryStatusList', () => {
  it('garde le menu fermé et relie le déclencheur au menu', async () => {
    const wrapper = await mountList()

    const trigger = wrapper.get('[data-testid="trigger"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-controls')).toBe(wrapper.get('[role="menu"]').attributes('id'))
    expect(wrapper.get('[role="menu"]').isVisible()).toBe(false)
  })

  it('ouvre les cinq statuts en menuitemradio et marque le statut actuel', async () => {
    const wrapper = await mountList()

    await openMenu(wrapper)

    expect(wrapper.findAll('[role="menuitemradio"]')).toHaveLength(5)
    expect(wrapper.get('[data-testid="demo-reading"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="demo-completed"]').attributes('aria-checked')).toBe('false')
    expect(wrapper.get('[data-testid="trigger"]').attributes('aria-expanded')).toBe('true')
  })

  it('émet le nouveau statut, referme le menu et rend le focus au déclencheur', async () => {
    const wrapper = await mountList()
    await openMenu(wrapper)

    await wrapper.get('[data-testid="demo-on_hold"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([['on_hold']])
    expect(wrapper.get('[data-testid="trigger"]').attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wrapper.get('[data-testid="trigger"]').element)
  })

  it('n’émet rien quand on rechoisit le statut actuel', async () => {
    const wrapper = await mountList()
    await openMenu(wrapper)

    await wrapper.get('[data-testid="demo-reading"]').trigger('click')

    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('s’ouvre au-dessus du déclencheur près du bas de l’écran, au-dessous sinon', async () => {
    const wrapper = await mountList()
    const trigger = wrapper.get('[data-testid="trigger"]')
    const rect = vi.spyOn(trigger.element, 'getBoundingClientRect')

    rect.mockReturnValue({
      top: window.innerHeight - 50,
      bottom: window.innerHeight - 10,
    } as DOMRect)
    await trigger.trigger('click')
    expect(wrapper.get('[role="menu"]').classes()).toContain('status-list__panel--above')

    await trigger.trigger('click')
    rect.mockReturnValue({ top: 20, bottom: 60 } as DOMRect)
    await trigger.trigger('click')
    expect(wrapper.get('[role="menu"]').classes()).not.toContain('status-list__panel--above')
  })

  it('referme le menu avec Échap', async () => {
    const wrapper = await mountList()
    await openMenu(wrapper)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.get('[data-testid="trigger"]').attributes('aria-expanded')).toBe('false')
  })

  it('accueille un pied dans le menu et lui laisse refermer le menu', async () => {
    const wrapper = await mountList({ withFooter: true })
    await openMenu(wrapper)

    expect(wrapper.get('[role="menu"]').find('[data-testid="demo-footer"]').exists()).toBe(true)
    await wrapper.get('[data-testid="demo-footer"]').trigger('click')

    expect(wrapper.get('[data-testid="trigger"]').attributes('aria-expanded')).toBe('false')
  })

  it('prend toute la largeur de l’appelant avec `block`', async () => {
    const wrapper = await mountList({ block: true })

    expect(wrapper.classes()).toContain('status-list--block')
  })
})
