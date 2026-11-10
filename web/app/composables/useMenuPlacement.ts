/** Placement of dropdown menus relative to the window and the sticky header. */
import { menuPlacement } from '~/utils/menu'

/**
 * Places a dropdown menu in the window: under its button, or above it when room is short.
 * The sticky header hides the top of the window: it is subtracted from the room available above.
 */
export function useMenuPlacement() {
  return (trigger: { top: number; bottom: number }, contentHeight?: number) => {
    const header = document.querySelector('.layout-header')
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0)
    return menuPlacement(trigger, window.innerHeight, contentHeight, headerBottom)
  }
}
