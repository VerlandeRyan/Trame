// Placement des menus déroulants : logique pure, testée sans Nuxt.

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
