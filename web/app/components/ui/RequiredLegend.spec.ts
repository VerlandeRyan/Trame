import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiRequiredLegend from './RequiredLegend.vue'

describe('UiRequiredLegend', () => {
  it("explique l'étoile : « * champ obligatoire »", async () => {
    const wrapper = await mountSuspended(UiRequiredLegend)

    expect(wrapper.text()).toBe('* champ obligatoire')
  })

  it("laisse l'étoile à la légende : un lecteur d'écran lit la phrase entière", async () => {
    const wrapper = await mountSuspended(UiRequiredLegend)

    expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(false)
  })
})
