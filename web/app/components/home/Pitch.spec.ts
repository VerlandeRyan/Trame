import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HomePitch from './Pitch.vue'

describe('HomePitch', () => {
  it('présente les trois engagements sous le titre « Pourquoi Trame ? »', async () => {
    const wrapper = await mountSuspended(HomePitch)

    expect(wrapper.get('section').attributes('aria-label')).toBe('Pourquoi Trame ?')
    expect(wrapper.findAll('li h3').map((heading) => heading.text())).toEqual([
      'Garde le fil de tes lectures',
      'Une seule appli pour tout tracker',
      'Des œuvres introuvables ailleurs',
    ])
  })

  it("cache l'autocollant aux lecteurs d'écran, le titre étant déjà le nom de la région", async () => {
    const wrapper = await mountSuspended(HomePitch)

    expect(wrapper.get('.pitch__sticker').attributes('aria-hidden')).toBe('true')
  })

  it('propose « Créer ma liste de lecture », inactif tant que la connexion n’existe pas', async () => {
    const wrapper = await mountSuspended(HomePitch)

    const button = wrapper.get('[data-testid="home-create-list"]')
    expect(button.text()).toBe('Créer ma liste de lecture')
    expect(button.attributes('disabled')).toBeDefined()
  })
})
