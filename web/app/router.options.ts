import type { RouterConfig } from '@nuxt/schema'
import { shouldScrollToTop } from '~/utils/scroll'

export default <RouterConfig>{
  // Vue Router attend ce type composé : position mémorisée, ancre, haut de page ou rien.
  // eslint-disable-next-line sonarjs/function-return-type
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash }
    if (shouldScrollToTop(to, from)) return { left: 0, top: 0 }
    return false
  },
}
