import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody, setResponseStatus } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
import { ANONYMOUS, type AuthState } from '~/utils/auth'

const USER = { id: 7, handle: 'Ryan', role: 'user' } as const

let me: AuthState | 'fail' = ANONYMOUS
let posted: { path: string; body: unknown }[] = []

// Le composable se teste monté dans un composant, comme dans l'application.
const Probe = defineComponent({
  setup: () => useAuth(),
  render: () => h('div'),
})

async function mountProbe() {
  const wrapper = await mountSuspended(Probe)
  return wrapper.vm as unknown as ReturnType<typeof useAuth>
}

describe('useAuth', () => {
  beforeEach(() => {
    useRuntimeConfig().apiBase = ''
    useState('auth').value = ANONYMOUS
    me = ANONYMOUS
    posted = []
    registerEndpoint('/api/v1/auth/me', () => {
      if (me === 'fail') throw createError({ statusCode: 500, data: { code: 'INTERNAL_ERROR' } })
      return me
    })
    registerEndpoint('/api/v1/auth/handle', {
      method: 'POST',
      handler: async (event) => {
        const body = (await readBody(event)) as { handle: string }
        if (body.handle === 'pris') {
          setResponseStatus(event, 409)
          return { code: 'HANDLE_TAKEN' }
        }
        posted.push({ path: 'handle', body })
        return { status: 'authenticated', user: { ...USER, handle: body.handle } }
      },
    })
    for (const route of ['logout', 'cancel']) {
      registerEndpoint(`/api/v1/auth/${route}`, {
        method: 'POST',
        handler: () => {
          posted.push({ path: route, body: null })
          return null
        },
      })
    }
  })

  it("lit l'état de connexion auprès de l'API", async () => {
    me = { status: 'authenticated', user: USER }
    const auth = await mountProbe()

    await auth.refresh()

    expect(auth.state).toEqual({ status: 'authenticated', user: USER })
  })

  it('reste anonyme quand la lecture échoue', async () => {
    me = 'fail'
    const auth = await mountProbe()

    await auth.refresh()

    expect(auth.state).toEqual(ANONYMOUS)
  })

  it('crée le compte avec le pseudo choisi et devient connecté', async () => {
    const auth = await mountProbe()

    await auth.createAccount('Ryan_B')

    expect(posted).toEqual([{ path: 'handle', body: { handle: 'Ryan_B' } }])
    expect(auth.state).toEqual({ status: 'authenticated', user: { ...USER, handle: 'Ryan_B' } })
  })

  it("laisse remonter le code d'erreur de l'API", async () => {
    const auth = await mountProbe()

    await expect(auth.createAccount('pris')).rejects.toMatchObject({ code: 'HANDLE_TAKEN' })
    expect(auth.state).toEqual(ANONYMOUS)
  })

  it("se déconnecte, ou abandonne l'inscription, puis redevient anonyme", async () => {
    me = { status: 'authenticated', user: USER }
    const auth = await mountProbe()
    await auth.refresh()

    await auth.signOut()
    expect(auth.state).toEqual(ANONYMOUS)

    await auth.cancelSignup()
    expect(posted.map((call) => call.path)).toEqual(['logout', 'cancel'])
  })
})
