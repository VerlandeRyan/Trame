/** Router scroll behaviour: restore the saved position, jump to an anchor, or go to the top. */
import type { RouterConfig } from '@nuxt/schema'
import { shouldScrollToTop } from '~/utils/scroll'

export default <RouterConfig>{
  // Vue Router expects this mixed return type: saved position, anchor, top of page or nothing.
  // eslint-disable-next-line sonarjs/function-return-type
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash }
    if (shouldScrollToTop(to, from)) return { left: 0, top: 0 }
    return false
  },
}
