/** Placement of dropdown menus: pure logic, tested without Nuxt. */

/** Height of a menu row (touch target). */
export const MENU_ROW_HEIGHT_PX = 44
/** Wanted height of a choice menu before it scrolls internally (18 rem). */
export const MENU_PREFERRED_HEIGHT_PX = 288
/** Gap kept between a menu and the window edge. */
const MENU_EDGE_GAP_PX = 16
const MENU_MIN_HEIGHT_PX = 132
/** Rows a menu must be able to show under its button, scrolling, before it opens above. */
const MENU_MIN_OPEN_ROWS = 3

/**
 * Height of a menu opening under its button: the wanted one, reduced to the room left in the
 * window (the menu then scrolls) so the page never grows; at least three options.
 */
export function menuMaxHeight(triggerBottom: number, viewportHeight: number): number {
  const room = viewportHeight - triggerBottom - MENU_EDGE_GAP_PX
  return Math.min(MENU_PREFERRED_HEIGHT_PX, Math.max(MENU_MIN_HEIGHT_PX, room))
}

/**
 * Whether to open the menu above its button: yes when the space below cannot hold it entirely
 * and the space above offers more room.
 */
export function shouldOpenAbove(
  trigger: { top: number; bottom: number },
  viewportHeight: number,
  menuHeight: number,
): boolean {
  const spaceBelow = viewportHeight - trigger.bottom
  const spaceAbove = trigger.top
  return spaceBelow < menuHeight && spaceAbove > spaceBelow
}

/**
 * Where to open a menu. It opens under its button, scrolling if room is short; it goes above
 * only when the space below cannot show three rows and the space above has more room.
 * `topInset` is the height of the sticky header, which hides the top of the window; `contentHeight`
 * is the menu height if it did not have to scroll (the wanted height by default).
 */
export function menuPlacement(
  trigger: { top: number; bottom: number },
  viewportHeight: number,
  contentHeight = MENU_PREFERRED_HEIGHT_PX,
  topInset = 0,
): { isAbove: boolean; maxHeight: number } {
  const spaceBelow = viewportHeight - trigger.bottom - MENU_EDGE_GAP_PX
  const spaceAbove = trigger.top - topInset - MENU_EDGE_GAP_PX
  const content = Math.min(contentHeight, MENU_PREFERRED_HEIGHT_PX)
  const minimumBelow = Math.min(content, MENU_MIN_OPEN_ROWS * MENU_ROW_HEIGHT_PX)
  const isAbove = spaceBelow < minimumBelow && spaceAbove > spaceBelow
  const edge = isAbove ? viewportHeight - trigger.top + topInset : trigger.bottom
  return { isAbove, maxHeight: menuMaxHeight(edge, viewportHeight) }
}
