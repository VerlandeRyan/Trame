import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import AuthSignInModal from './SignInModal.vue'

describe('AuthSignInModal', () => {
  beforeEach(() => {
    useSignInModal().value = false
  })

  it('reste fermée tant que personne ne la demande, puis s’ouvre', async () => {
    const wrapper = await mountSuspended(AuthSignInModal)
    expect(wrapper.get('dialog').attributes('open')).toBeUndefined()

    useSignInModal().value = true
    await nextTick()

    expect(wrapper.get('dialog').attributes('open')).toBeDefined()
  })

  it('présente la connexion Google, les engagements et la mention légale', async () => {
    const wrapper = await mountSuspended(AuthSignInModal)

    expect(wrapper.get('h2').text()).toBe('Connecte-toi à Trame')
    expect(wrapper.get('[data-testid="sign-in-google"]').text()).toBe('Continuer avec Google')
    expect(wrapper.findAll('li').map((item) => item.text())).toEqual([
      'Aucun mot de passe à créer ni à retenir.',
      "Ton adresse e-mail n'est jamais affichée.",
      'Tu choisis ensuite un pseudo public.',
    ])
    expect(wrapper.text()).toContain("En continuant, tu acceptes les conditions d'utilisation")
  })

  it('envoie vers Google en gardant la page où l’on se trouve, langue comprise', async () => {
    const wrapper = await mountSuspended(AuthSignInModal, { route: '/en/search?q=basalte' })

    expect(wrapper.get('[data-testid="sign-in-google"]').attributes('href')).toBe(
      '/api/v1/auth/google?returnTo=%2Fen%2Fsearch%3Fq%3Dbasalte',
    )
  })

  it('se ferme avec la croix', async () => {
    const wrapper = await mountSuspended(AuthSignInModal)
    useSignInModal().value = true
    await nextTick()

    await wrapper.get('button[aria-label="Fermer"]').trigger('click')

    expect(useSignInModal().value).toBe(false)
  })
})
