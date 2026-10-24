// Placement des menus déroulants : logique pure, testée sans Nuxt.

/**
 * Faut-il ouvrir le menu au-dessus de son bouton ? Oui quand le dessous de l'écran ne le contient
 * pas en entier et que le dessus offre plus de place.
 */
/** Hauteur souhaitée d'un menu de choix avant défilement interne (18 rem). */
export const MENU_PREFERRED_HEIGHT_PX = 288
const MENU_EDGE_GAP_PX = 16
const MENU_MIN_HEIGHT_PX = 132

/**
 * Hauteur d'un menu qui s'ouvre sous son bouton : celle voulue, réduite à la place restante dans
 * la fenêtre (le menu défile alors) pour ne jamais rallonger la page ; trois options au moins.
 */
export function menuMaxHeight(triggerBottom: number, viewportHeight: number): number {
  const room = viewportHeight - triggerBottom - MENU_EDGE_GAP_PX
  return Math.min(MENU_PREFERRED_HEIGHT_PX, Math.max(MENU_MIN_HEIGHT_PX, room))
}

export function shouldOpenAbove(
  trigger: { top: number; bottom: number },
  viewportHeight: number,
  menuHeight: number,
): boolean {
  const spaceBelow = viewportHeight - trigger.bottom
  const spaceAbove = trigger.top
  return spaceBelow < menuHeight && spaceAbove > spaceBelow
}
