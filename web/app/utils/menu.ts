// Placement des menus déroulants : logique pure, testée sans Nuxt.

/** Hauteur d'une ligne de menu (zone tactile). */
export const MENU_ROW_HEIGHT_PX = 44
/** Hauteur souhaitée d'un menu de choix avant défilement interne (18 rem). */
export const MENU_PREFERRED_HEIGHT_PX = 288
const MENU_EDGE_GAP_PX = 16
const MENU_MIN_HEIGHT_PX = 132
/** Lignes qu'un menu doit pouvoir montrer sous le bouton, en défilant, avant de s'ouvrir au-dessus. */
const MENU_MIN_OPEN_ROWS = 3

/**
 * Hauteur d'un menu qui s'ouvre sous son bouton : celle voulue, réduite à la place restante dans
 * la fenêtre (le menu défile alors) pour ne jamais rallonger la page ; trois options au moins.
 */
export function menuMaxHeight(triggerBottom: number, viewportHeight: number): number {
  const room = viewportHeight - triggerBottom - MENU_EDGE_GAP_PX
  return Math.min(MENU_PREFERRED_HEIGHT_PX, Math.max(MENU_MIN_HEIGHT_PX, room))
}

/**
 * Faut-il ouvrir le menu au-dessus de son bouton ? Oui quand le dessous de l'écran ne le contient
 * pas en entier et que le dessus offre plus de place.
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
 * Où ouvrir un menu. Il s'ouvre sous son bouton, en défilant si la place manque ; il passe au-dessus
 * seulement quand le dessous ne peut pas en montrer trois lignes et que le dessus a plus de place.
 * `topInset` est la hauteur de l'en-tête collant, qui cache le haut de la fenêtre ; `contentHeight`
 * celle du menu s'il n'avait pas à défiler (par défaut la hauteur voulue).
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
