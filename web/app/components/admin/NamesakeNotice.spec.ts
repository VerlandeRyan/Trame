import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { getQuery } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminNamesakes } from '~/contract/api'
import AdminNamesakeNotice from './NamesakeNotice.vue'

const requests: Record<string, unknown>[] = []
let found: { id: number; name: string; lifecycle: string }[] = []
let hasMore = false

beforeEach(() => {
  vi.useFakeTimers()
  requests.length = 0
  found = []
  hasMore = false
  useRuntimeConfig().apiBase = ''
  registerEndpoint('/api/v1/admin/publishers/namesakes', (event) => {
    requests.push(getQuery(event))
    return { items: found, hasMore }
  })
})

afterEach(() => vi.useRealTimers())

function mountNotice(props: { name: string; recordId?: number } = { name: '' }) {
  return mountSuspended(AdminNamesakeNotice, {
    props: { kind: 'publishers', ...props },
    slots: { default: '<input id="field" />' },
  })
}

/** Lets the typing pause elapse and the answer arrive. */
async function settle() {
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

describe('AdminNamesakeNotice', () => {
  it('affiche le champ et ne cherche rien tant que le nom est vide', async () => {
    const wrapper = await mountNotice({ name: '  ' })
    await settle()

    expect(wrapper.find('#field').exists()).toBe(true)
    expect(requests).toEqual([])
    expect(wrapper.find('[data-testid="namesake-notice"]').exists()).toBe(false)
  })

  it('signale une fiche du même nom, avec un lien vers elle et son état', async () => {
    found = [{ id: 12, name: 'Maison Éclair', lifecycle: 'published' }]
    const wrapper = await mountNotice({ name: 'maison eclair' })
    await settle()

    const notice = wrapper.get('[data-testid="namesake-notice"]')
    expect(notice.text()).toContain('Une fiche porte déjà ce nom')
    const link = notice.get('a')
    expect(link.text()).toBe('Maison Éclair')
    expect(link.attributes('href')).toBe('/admin/catalogue/publishers/12')
    expect(link.attributes('target')).toBe('_blank')
    expect(notice.text()).toContain('Publiée')
  })

  it('met au pluriel et nomme brouillons et archives', async () => {
    found = [
      { id: 1, name: 'Maison', lifecycle: 'draft' },
      { id: 2, name: 'Maison', lifecycle: 'archived' },
    ]
    const wrapper = await mountNotice({ name: 'Maison' })
    await settle()

    const text = wrapper.get('[data-testid="namesake-notice"]').text()
    expect(text).toContain('Des fiches portent déjà ce nom')
    expect(text).toContain('Brouillon')
    expect(text).toContain('Archivée')
  })

  it('exclut la fiche modifiée et cherche une seule fois après la pause de saisie', async () => {
    const wrapper = await mountNotice({ name: 'Mai', recordId: 5 })
    await wrapper.setProps({ name: 'Mais' })
    await wrapper.setProps({ name: 'Maison' })
    await settle()

    expect(requests).toEqual([{ name: 'Maison', excludeId: '5' }])
  })

  it('retire l’avertissement quand le nom est effacé', async () => {
    found = [{ id: 12, name: 'Maison', lifecycle: 'published' }]
    const wrapper = await mountNotice({ name: 'Maison' })
    await settle()
    expect(wrapper.find('[data-testid="namesake-notice"]').exists()).toBe(true)

    await wrapper.setProps({ name: '' })
    await settle()

    expect(wrapper.find('[data-testid="namesake-notice"]').exists()).toBe(false)
  })

  it('signale qu’il existe d’autres fiches au-delà de celles listées', async () => {
    found = [{ id: 1, name: 'Maison', lifecycle: 'published' }]
    hasMore = true
    const wrapper = await mountNotice({ name: 'Maison' })
    await settle()

    expect(wrapper.get('[data-testid="namesake-notice"]').text()).toContain(
      'Des fiches portent déjà ce nom',
    )
    expect(wrapper.get('[data-testid="namesake-more"]').text()).toBe(
      "D'autres fiches portent aussi ce nom.",
    )
  })

  it('parle de « titre » pour une œuvre', async () => {
    const lookup = () =>
      Promise.resolve({
        items: [{ id: 3, name: 'Brume', lifecycle: 'published' as const }],
        hasMore: true,
      })
    const wrapper = await mountSuspended(AdminNamesakeNotice, {
      props: { kind: 'works', name: 'Brume', lookup },
    })
    await settle()

    expect(wrapper.get('[data-testid="namesake-notice"]').text()).toContain(
      'Des fiches portent déjà ce titre',
    )
    expect(wrapper.get('[data-testid="namesake-more"]').text()).toContain('aussi ce titre')
  })

  it('masque l’ancien avertissement dès que le nom change, avant la nouvelle réponse', async () => {
    found = [{ id: 12, name: 'Maison', lifecycle: 'published' }]
    const wrapper = await mountNotice({ name: 'Maison' })
    await settle()

    await wrapper.setProps({ name: 'Maison N' })

    expect(wrapper.find('[data-testid="namesake-notice"]').exists()).toBe(false)
  })

  it('garde l’avertissement quand seuls la casse ou les espaces changent : pas de clignotement', async () => {
    found = [{ id: 12, name: 'Maison', lifecycle: 'published' }]
    const wrapper = await mountNotice({ name: 'Maison' })
    await settle()

    await wrapper.setProps({ name: '  maison  ' })

    expect(wrapper.find('[data-testid="namesake-notice"]').exists()).toBe(true)
  })

  it('annonce seulement la phrase dans la zone vivante, la liste restant à part', async () => {
    found = [{ id: 12, name: 'Maison', lifecycle: 'published' }]
    const wrapper = await mountNotice({ name: 'Maison' })
    const announcement = wrapper.get('[data-testid="namesake-announcement"]')
    expect(announcement.element.tagName).toBe('OUTPUT')
    expect(announcement.text()).toBe('')

    await settle()

    expect(announcement.text()).toBe('Une fiche porte déjà ce nom :')
    expect(announcement.find('ul, a').exists()).toBe(false)
  })

  it('relance la recherche quand la fiche modifiée change', async () => {
    const wrapper = await mountNotice({ name: 'Maison', recordId: 5 })
    await settle()
    await wrapper.setProps({ recordId: 6 })
    await settle()

    expect(requests.map((query) => query.excludeId)).toEqual(['5', '6'])
  })

  it('ignore la réponse d’une recherche plus ancienne qu’une recherche suivante', async () => {
    const answers = new Map<string, (value: AdminNamesakes) => void>()
    const lookup = (name: string) =>
      new Promise<AdminNamesakes>((resolve) => answers.set(name, resolve))
    const wrapper = await mountSuspended(AdminNamesakeNotice, {
      props: { kind: 'publishers', name: 'Ancien', lookup },
    })
    await vi.advanceTimersByTimeAsync(400)
    await wrapper.setProps({ name: 'Récent' })
    await vi.advanceTimersByTimeAsync(400)

    answers.get('Récent')?.({
      items: [{ id: 2, name: 'Récent', lifecycle: 'draft' }],
      hasMore: false,
    })
    await flushPromises()
    answers.get('Ancien')?.({
      items: [{ id: 1, name: 'Ancien', lifecycle: 'draft' }],
      hasMore: false,
    })
    await flushPromises()

    const text = wrapper.get('[data-testid="namesake-notice"]').text()
    expect(text).toContain('Récent')
    expect(text).not.toContain('Ancien')
  })

  it('reste muet quand la recherche échoue : l’avertissement est facultatif', async () => {
    registerEndpoint('/api/v1/admin/publishers/namesakes', () => {
      throw createError({ statusCode: 500 })
    })
    const wrapper = await mountNotice({ name: 'Maison' })
    await settle()

    expect(wrapper.find('[data-testid="namesake-notice"]').exists()).toBe(false)
  })
})
