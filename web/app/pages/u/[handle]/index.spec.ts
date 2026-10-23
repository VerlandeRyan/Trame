import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '~/utils/auth'
import type { Profile } from '~/utils/profile'
import type { WorkSummary } from '~/utils/search'
import ProfilePage from './index.vue'

const WORK: WorkSummary = {
  id: 7,
  title: 'Aube Fictive',
  originalTitle: 'Aube Fictive',
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  formats: ['manga'],
  coverPath: null,
  mainAuthor: null,
}

const publicProfile = (overrides: Partial<Profile> = {}): Profile => ({
  handle: 'lectrice',
  visibility: 'public',
  isOwner: false,
  details: {
    memberSince: '2026-10-01T10:00:00.000Z',
    stats: {
      worksFollowed: 53,
      ratingAverage: 8.4,
      statusCounts: { reading: 12, completed: 31, plan_to_read: 8, on_hold: 2, dropped: 0 },
      chaptersRead: 1240,
      volumesRead: 86,
    },
    recentUpdates: [
      {
        work: WORK,
        entry: {
          status: 'reading',
          chaptersRead: 12,
          volumesRead: 0,
          rating: null,
          startedOn: null,
          finishedOn: null,
        },
        updatedAt: new Date().toISOString(),
      },
    ],
    topRated: [{ work: WORK, rating: 10 }],
  },
  ...overrides,
})

let profile: Profile
let visibilityBodies: unknown[] = []

beforeEach(() => {
  clearNuxtState()
  clearNuxtData()
  useState<AuthState>('auth').value = { status: 'anonymous' }
  useRuntimeConfig().apiBase = ''
  visibilityBodies = []
  profile = publicProfile()
  registerEndpoint('/api/v1/users/lectrice', () => profile)
  registerEndpoint('/api/v1/users/inconnue', () => {
    throw createError({ statusCode: 404, data: { code: 'NOT_FOUND' } })
  })
  registerEndpoint('/api/v1/me/profile', {
    method: 'PATCH',
    handler: async (event) => {
      const body = (await readBody(event)) as { visibility: Profile['visibility'] }
      visibilityBodies.push(body)
      profile = { ...profile, visibility: body.visibility }
      return body
    },
  })
})

const mountProfile = (path = '/u/lectrice') => mountSuspended(ProfilePage, { route: path })

describe('page Profil', () => {
  it('affiche le pseudo, les deux totaux séparés, les statuts et les listes', async () => {
    const wrapper = await mountProfile()

    expect(wrapper.get('[data-testid="profile-handle"]').text()).toBe('@lectrice')
    expect(wrapper.get('[data-testid="profile-chapters"]').text()).toContain('1')
    expect(wrapper.get('[data-testid="profile-volumes"]').text()).toContain('86')
    expect(wrapper.get('[data-testid="profile-followed"]').text()).toBe('53')
    expect(wrapper.get('[data-testid="profile-average"]').text()).toContain('8,4')
    expect(wrapper.get('[data-testid="profile-recent"]').text()).toContain('Aube Fictive')
    expect(wrapper.get('[data-testid="profile-recent"]').text()).toContain('Chapitre 12')
    expect(wrapper.get('[data-testid="profile-top-rated"]').text()).toContain('10 / 10')
    expect(wrapper.get('[data-testid="profile-list-link"]').attributes('href')).toBe(
      '/u/lectrice/list',
    )
    expect(wrapper.find('[data-testid="profile-visibility"]').exists()).toBe(false)
  })

  it('résume chaque mise à jour : tome atteint, ou terminée avec ou sans note', async () => {
    const [reading] = profile.details!.recentUpdates
    profile.details!.recentUpdates = [
      { ...reading!, entry: { ...reading!.entry, chaptersRead: 0, volumesRead: 2 } },
      {
        ...reading!,
        work: { ...WORK, id: 8 },
        entry: { ...reading!.entry, status: 'completed', rating: 9 },
      },
      { ...reading!, work: { ...WORK, id: 9 }, entry: { ...reading!.entry, status: 'completed' } },
    ]

    const wrapper = await mountProfile()

    const progress = wrapper.findAll('.profile__progress').map((label) => label.text())
    expect(progress).toEqual(['Tome 2', 'Terminée · note 9', 'Terminée'])
  })

  it('montre « — » sans note donnée et un message sans lecture', async () => {
    profile = publicProfile()
    profile.details!.stats.ratingAverage = null
    profile.details!.recentUpdates = []
    profile.details!.topRated = []

    const wrapper = await mountProfile()

    expect(wrapper.get('[data-testid="profile-average"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="profile-recent"]').text()).toContain('Aucune lecture')
    expect(wrapper.get('[data-testid="profile-top-rated"]').text()).toContain('Aucune note')
  })

  it('n’affiche que le pseudo et un message pour un profil privé', async () => {
    profile = { handle: 'discrete', visibility: 'private', isOwner: false, details: null }
    registerEndpoint('/api/v1/users/discrete', () => profile)

    const wrapper = await mountProfile('/u/discrete')

    expect(wrapper.get('[data-testid="profile-private"]').text()).toContain('Ce profil est privé')
    expect(wrapper.find('[data-testid="profile-recent"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-list-link"]').exists()).toBe(false)
  })

  it('répond 404 pour un membre inconnu', async () => {
    clearError()
    // Le rendu de la page interrompue peut lever : seule compte l'erreur fatale enregistrée.
    await mountProfile('/u/inconnue').catch(() => undefined)

    expect(useError().value).toMatchObject({ statusCode: 404 })
    clearError()
  })

  it('laisse son propriétaire passer le profil en privé', async () => {
    profile = publicProfile({ isOwner: true })
    useState<AuthState>('auth').value = {
      status: 'authenticated',
      user: { id: 1, handle: 'lectrice', role: 'user' },
    }
    const wrapper = await mountProfile()

    expect(wrapper.get('[data-testid="profile-visibility"]').text()).toContain('Profil public')
    expect(wrapper.get('[data-testid="profile-list-link"]').text()).toContain('Ouvrir ma liste')
    expect(wrapper.get('[data-testid="profile-list-link"]').attributes('href')).toBe('/list')
    expect(wrapper.get('[data-testid="profile-status-reading"]').attributes('href')).toBe(
      '/list?status=reading',
    )

    await wrapper.get('[data-testid="profile-visibility-toggle"]').trigger('click')
    await vi.waitFor(() => expect(visibilityBodies).toEqual([{ visibility: 'private' }]))
  })

  it('le dit quand la visibilité ne s’enregistre pas', async () => {
    profile = publicProfile({ isOwner: true })
    registerEndpoint('/api/v1/me/profile', {
      method: 'PATCH',
      handler: () => {
        throw createError({ statusCode: 500, data: { code: 'INTERNAL_ERROR' } })
      },
    })
    const wrapper = await mountProfile()

    await wrapper.get('[data-testid="profile-visibility-toggle"]').trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-visibility"] [role="alert"]').text()).toContain(
        'Impossible d',
      ),
    )
    expect(wrapper.get('[data-testid="profile-visibility"]').text()).toContain('Profil public')
  })

  it('copie le lien de son profil, et n’annonce rien si la copie est refusée', async () => {
    profile = publicProfile({ isOwner: true })
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('refusé'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = await mountProfile()
    const copyButton = wrapper.get('[data-testid="profile-copy-link"]')

    await copyButton.trigger('click')
    await vi.waitFor(() => expect(copyButton.text()).toBe('Lien copié'))
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/u\/lectrice$/))

    await copyButton.trigger('click')
    await vi.waitFor(() => expect(copyButton.text()).toBe('Copier le lien de mon profil'))
    Reflect.deleteProperty(navigator, 'clipboard')
  })
})
