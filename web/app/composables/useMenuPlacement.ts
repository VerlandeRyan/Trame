import { menuPlacement } from '~/utils/menu'

/**
 * Place un menu déroulant dans la fenêtre : sous son bouton, ou au-dessus s'il manque de la place.
 * L'en-tête collant cache le haut de la fenêtre : il est retiré de la place disponible au-dessus.
 */
export function useMenuPlacement() {
  return (trigger: { top: number; bottom: number }, contentHeight?: number) => {
    const header = document.querySelector('.layout-header')
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0)
    return menuPlacement(trigger, window.innerHeight, contentHeight, headerBottom)
  }
}
