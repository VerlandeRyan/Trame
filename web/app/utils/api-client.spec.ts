import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from './api-client'

const fetcher = vi.fn()

function makeClient() {
  return createApiClient({
    baseURL: 'http://api.test',
    fetcher,
    hasTranslation: (key) => key === 'error.ADMIN_REQUIRED',
  })
}

beforeEach(() => {
  fetcher.mockReset()
})

describe('createApiClient().request', () => {
  it("appelle l'API sous /api/v1 avec l'adresse interne configurée", async () => {
    fetcher.mockResolvedValue({ ok: true })

    const result = await makeClient().request('/works')

    expect(result).toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/works', { baseURL: 'http://api.test' })
  })

  it('transmet les options de la requête', async () => {
    fetcher.mockResolvedValue({})

    await makeClient().request('/works', { method: 'POST' })

    expect(fetcher).toHaveBeenCalledWith('/api/v1/works', {
      baseURL: 'http://api.test',
      method: 'POST',
    })
  })

  it('ajoute les en-têtes par défaut (cookie du visiteur au rendu serveur) à chaque appel', async () => {
    fetcher.mockResolvedValue({})
    const client = createApiClient({
      baseURL: 'http://api.test',
      fetcher,
      hasTranslation: () => false,
      defaultHeaders: { cookie: 'trame.sid=abc' },
    })

    await client.request('/me/entries')
    await client.request('/works', { headers: { 'x-test': '1' } })

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/me/entries', {
      baseURL: 'http://api.test',
      headers: { cookie: 'trame.sid=abc' },
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/v1/works', {
      baseURL: 'http://api.test',
      headers: { cookie: 'trame.sid=abc', 'x-test': '1' },
    })
  })

  it("n'ajoute aucun en-tête sans en-têtes par défaut", async () => {
    fetcher.mockResolvedValue({})

    await makeClient().request('/works')

    expect(fetcher).toHaveBeenCalledWith('/api/v1/works', { baseURL: 'http://api.test' })
  })

  it("lève une erreur normalisée avec le code stable de l'API", async () => {
    fetcher.mockRejectedValue({ response: { status: 403, _data: { code: 'ADMIN_REQUIRED' } } })

    await expect(makeClient().request('/admin')).rejects.toEqual({
      status: 403,
      code: 'ADMIN_REQUIRED',
      details: undefined,
    })
  })
})

describe('createApiClient().messageKeyFor', () => {
  it("renvoie la clé du code connu, sinon celle de l'erreur interne", () => {
    const { messageKeyFor } = makeClient()

    expect(messageKeyFor({ status: 403, code: 'ADMIN_REQUIRED' })).toBe('error.ADMIN_REQUIRED')
    expect(messageKeyFor({ status: 500, code: 'INCONNU' })).toBe('error.INTERNAL_ERROR')
  })
})
