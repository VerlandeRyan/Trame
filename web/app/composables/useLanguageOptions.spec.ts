import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

// Le composable se teste monté dans un composant, comme dans l'application.
const Probe = defineComponent({
  setup() {
    const optionsFor = useLanguageOptions()
    return () =>
      h(
        'p',
        optionsFor('sw')
          .map((option) => option.label)
          .join('|'),
      )
  },
})

describe('useLanguageOptions', () => {
  it('libelle les langues dans celle de l’interface, avec leur code ISO', async () => {
    const wrapper = await mountSuspended(Probe)

    expect(wrapper.text()).toMatch(/^swahili \(sw\)\|français \(fr\)\|anglais \(en\)/)
  })
})
