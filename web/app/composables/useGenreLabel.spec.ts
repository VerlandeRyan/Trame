import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

// Le composable se teste monté dans un composant, comme dans l'application.
const Probe = defineComponent({
  setup() {
    const genreLabel = useGenreLabel()
    return () => h('p', `${genreLabel('manga')}|${genreLabel('code_inconnu')}`)
  },
})

describe('useGenreLabel', () => {
  it('traduit un code connu et garde tel quel un code sans traduction', async () => {
    const wrapper = await mountSuspended(Probe)

    expect(wrapper.text()).toBe('Manga|code_inconnu')
  })
})
