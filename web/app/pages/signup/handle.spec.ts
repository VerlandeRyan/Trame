import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody, setResponseStatus } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HandlePage from './handle.vue'

let created: string[] = []
let failure: { statusCode: number; code: string } | null = null
let cancelled = 0
let cancelFails = false

const USER = { id: 3, role: 'user' }

function pending() {
  useState('auth').value = { status: 'pending' }
}

async function mountPage(route = '/signup/handle') {
  return mountSuspended(HandlePage, { route })
}

describe('page de choix du pseudo', () => {
  beforeEach(() => {
    useRuntimeConfig().apiBase = ''
    pending()
    created = []
    failure = null
    cancelled = 0
    cancelFails = false
    registerEndpoint('/api/v1/auth/handle', {
      method: 'POST',
      handler: async (event) => {
        if (failure) {
          setResponseStatus(event, failure.statusCode)
          return { code: failure.code }
        }
        const { handle } = (await readBody(event)) as { handle: string }
        created.push(handle)
        return { status: 'authenticated', user: { ...USER, handle } }
      },
    })
    registerEndpoint('/api/v1/auth/cancel', {
      method: 'POST',
      handler: (event) => {
        if (cancelFails) {
          setResponseStatus(event, 500)
          return { code: 'INTERNAL_ERROR' }
        }
        cancelled += 1
        return null
      },
    })
  })

  it('présente les deux étapes, le champ et le bouton inactif tant que le pseudo est vide', async () => {
    const wrapper = await mountPage()

    expect(wrapper.get('h1').text()).toBe('Choisis ton pseudo')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Ton pseudo')
    expect(wrapper.get('input').attributes('maxlength')).toBe('30')
    expect(wrapper.get('[data-testid="handle-submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="handle-address"]').exists()).toBe(false)
  })

  it("active le bouton et montre l'adresse du profil pour un pseudo valide, casse conservée", async () => {
    const wrapper = await mountPage()

    await wrapper.get('input').setValue('Lecteur_Ame')

    expect(wrapper.get('[data-testid="handle-submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="handle-address"]').text()).toContain('/u/Lecteur_Ame')
  })

  it('garde le bouton inactif pour un format invalide', async () => {
    const wrapper = await mountPage()

    await wrapper.get('input').setValue('mon pseudo')

    expect(wrapper.get('[data-testid="handle-submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="handle-address"]').exists()).toBe(false)
  })

  it('crée le compte puis revient à la page demandée', async () => {
    const wrapper = await mountPage('/signup/handle?returnTo=%2Fsearch%3Fq%3Dbasalte')
    await wrapper.get('input').setValue('Ryan')

    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() =>
      expect(useState('auth').value).toMatchObject({ status: 'authenticated' }),
    )
    expect(created).toEqual(['Ryan'])
    await vi.waitFor(() => expect(useRoute().fullPath).toBe('/search?q=basalte'))
  })

  it('ignore un returnTo qui sort du site', async () => {
    const wrapper = await mountPage('/signup/handle?returnTo=https%3A%2F%2Fevil.test')
    await wrapper.get('input').setValue('Ryan')

    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(useRoute().path).toBe('/'))
  })

  it.each([
    ['HANDLE_TAKEN', 409, 'Ce pseudo est déjà pris. Essaie un autre.'],
    ['HANDLE_NOT_ALLOWED', 400, 'Ce pseudo est réservé. Choisis-en un autre.'],
  ])('affiche %s sous le champ, sans le détailler davantage', async (code, statusCode, message) => {
    failure = { statusCode, code }
    const wrapper = await mountPage()
    await wrapper.get('input').setValue('admin')

    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toBe(message))
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    await wrapper.get('input').setValue('autre')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it("renvoie à l'accueil avec un avis quand l'inscription a expiré", async () => {
    failure = { statusCode: 401, code: 'SIGNUP_EXPIRED' }
    const wrapper = await mountPage()
    await wrapper.get('input').setValue('Ryan')

    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(useRoute().fullPath).toBe('/?auth_error=SIGNUP_EXPIRED'))
    expect(useState('auth').value).toEqual({ status: 'anonymous' })
  })

  it("reste sur la page et le dit quand l'abandon échoue", async () => {
    cancelFails = true
    const wrapper = await mountPage()
    await wrapper.get('[data-testid="handle-cancel"]').trigger('click')

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(useRoute().path).toBe('/signup/handle')
  })

  it("demande confirmation avant d'abandonner, et garde l'inscription si on refuse", async () => {
    const wrapper = await mountPage()

    await wrapper.get('[data-testid="handle-cancel"]').trigger('click')
    expect(wrapper.get('dialog').attributes('open')).toBeDefined()
    expect(wrapper.get('dialog h2').text()).toBe("Annuler l'inscription ?")
    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')

    expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    expect(cancelled).toBe(0)
    expect(useRoute().path).toBe('/signup/handle')
  })

  it("abandonne l'inscription : rien n'est enregistré, l'accueil l'annonce", async () => {
    const wrapper = await mountPage()

    await wrapper.get('[data-testid="handle-cancel"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() => expect(useRoute().fullPath).toBe('/?auth_error=signup_cancelled'))
    expect(cancelled).toBe(1)
    expect(created).toEqual([])
  })

  it("renvoie à l'accueil quand aucune inscription n'est en attente", async () => {
    useState('auth').value = { status: 'anonymous' }

    await mountPage()

    await vi.waitFor(() => expect(useRoute().path).toBe('/'))
  })
})
