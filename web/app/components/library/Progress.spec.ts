import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { LibraryEntry } from '~/utils/library'
import LibraryProgress from './Progress.vue'

const READING: LibraryEntry = {
  status: 'reading',
  chaptersRead: 12,
  volumesRead: 2,
  rating: 8,
  startedOn: '2026-01-01',
  finishedOn: null,
}

function mountProgress(
  entry: Partial<LibraryEntry> = {},
  totals: { chapters: number | null; volumes: number | null } = { chapters: null, volumes: null },
) {
  return mountSuspended(LibraryProgress, {
    props: {
      entry: { ...READING, ...entry },
      totalChapters: totals.chapters,
      totalVolumes: totals.volumes,
    },
  })
}

describe('LibraryProgress', () => {
  it('affiche « sur ? » quand le total est inconnu, sinon « sur N »', async () => {
    const unknown = await mountProgress()
    expect(unknown.findAll('.progress__total').map((total) => total.text())).toEqual([
      'sur ?',
      'sur ?',
      'sur 10',
    ])

    const known = await mountProgress({}, { chapters: 120, volumes: 3 })
    expect(known.findAll('.progress__total').map((total) => total.text())).toEqual([
      'sur 120',
      'sur 3',
      'sur 10',
    ])
  })

  it('modifie chapitres et tomes indépendamment', async () => {
    const wrapper = await mountProgress()

    await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')
    await wrapper.get('[aria-label="Augmenter : Tomes lus"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([[{ chaptersRead: 13 }], [{ volumesRead: 3 }]])
  })

  describe('un chapitre ou un tome de plus sur une œuvre qui n’est pas « En cours »', () => {
    const NOT_STARTED = { chaptersRead: 0, volumesRead: 0, rating: null }
    const TO_READ = { ...NOT_STARTED, status: 'plan_to_read' as const }

    it('demande de commencer une œuvre « À lire », sans rien envoyer d’ici là', async () => {
      const wrapper = await mountProgress(TO_READ)

      await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')

      expect(wrapper.text()).toContain('Tu as commencé cette œuvre ?')
      expect(wrapper.emitted('change')).toBeUndefined()
    })

    it.each(['on_hold', 'dropped'] as const)(
      'demande de reprendre une œuvre « %s »',
      async (status) => {
        const wrapper = await mountProgress({ ...NOT_STARTED, status })

        await wrapper.get('[aria-label="Augmenter : Tomes lus"]').trigger('click')

        expect(wrapper.text()).toContain('Reprendre la lecture ?')
        expect(wrapper.emitted('change')).toBeUndefined()
      },
    )

    it('passe en « En cours » avec le compteur quand on confirme', async () => {
      const wrapper = await mountProgress(TO_READ)

      await wrapper.get('[aria-label="Augmenter : Tomes lus"]').trigger('click')
      await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
      await nextTick()

      expect(wrapper.emitted('change')).toEqual([[{ volumesRead: 1, status: 'reading' }]])
    })

    it('n’enregistre rien quand on annule, ni compteur ni statut', async () => {
      const wrapper = await mountProgress(TO_READ)

      await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')
      await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')
      await nextTick()

      expect(wrapper.emitted('change')).toBeUndefined()
    })

    it('n’enregistre rien non plus quand on ferme la fenêtre par la croix', async () => {
      const wrapper = await mountProgress({ ...NOT_STARTED, status: 'dropped' })

      await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')
      await wrapper.get('[aria-label="Fermer"]').trigger('click')
      await nextTick()

      expect(wrapper.emitted('change')).toBeUndefined()
    })

    it('remet le compteur à sa vraie valeur après une saisie annulée', async () => {
      const wrapper = await mountProgress(TO_READ)
      const field = wrapper.get('input[aria-label="Chapitres lus"]')

      await field.setValue('42')
      await field.trigger('change')
      await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')
      await nextTick()
      await nextTick()

      expect(wrapper.emitted('change')).toBeUndefined()
      expect(wrapper.get('input[aria-label="Chapitres lus"]').element).toHaveProperty('value', '0')
    })

    it('ne demande rien pour la note ni pour une œuvre « En cours » ou « Terminé »', async () => {
      const rated = await mountProgress(TO_READ)
      await rated.get('[aria-label="Augmenter : Ma note"]').trigger('click')
      expect(rated.emitted('change')).toEqual([[{ rating: 1 }]])

      for (const status of ['reading', 'completed'] as const) {
        const wrapper = await mountProgress({ ...NOT_STARTED, status })
        await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')
        expect(wrapper.emitted('change')).toEqual([[{ chaptersRead: 1 }]])
      }
    })
  })

  describe('total connu atteint', () => {
    const TOTALS = { chapters: 158, volumes: 4 }
    const NEAR_END = { status: 'reading' as const, chaptersRead: 157, volumesRead: 3 }

    async function reachChapterTotal() {
      const wrapper = await mountProgress(NEAR_END, TOTALS)
      await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')
      return wrapper
    }

    it('propose « Terminé », sans rien envoyer d’ici là', async () => {
      const wrapper = await reachChapterTotal()

      expect(wrapper.text()).toContain('Tu as fini cette œuvre ?')
      expect(wrapper.text()).toContain('Tu as lu tous les chapitres parus (158)')
      expect(wrapper.emitted('change')).toBeUndefined()
    })

    it('propose aussi « Terminé » en atteignant le total de tomes', async () => {
      const wrapper = await mountProgress(NEAR_END, TOTALS)

      await wrapper.get('[aria-label="Augmenter : Tomes lus"]').trigger('click')

      expect(wrapper.text()).toContain('Tu as lu tous les tomes parus (4)')
    })

    it('passe en « Terminé » avec le compteur quand on confirme', async () => {
      const wrapper = await reachChapterTotal()

      await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
      await nextTick()

      expect(wrapper.emitted('change')).toEqual([[{ chaptersRead: 158, status: 'completed' }]])
    })

    it('enregistre le compteur seul quand on garde le statut', async () => {
      const wrapper = await reachChapterTotal()
      expect(wrapper.get('[data-testid="confirm-cancel"]').text()).toBe('Garder « En cours »')

      await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')
      await nextTick()

      expect(wrapper.emitted('change')).toEqual([[{ chaptersRead: 158 }]])
    })

    it('n’enregistre rien quand on ferme la fenêtre par la croix', async () => {
      const wrapper = await reachChapterTotal()

      await wrapper.get('[aria-label="Fermer"]').trigger('click')
      await nextTick()

      expect(wrapper.emitted('change')).toBeUndefined()
    })

    it('ne demande rien quand l’œuvre est déjà « Terminé »', async () => {
      const wrapper = await mountProgress({ ...NEAR_END, status: 'completed' }, TOTALS)

      await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')

      expect(wrapper.emitted('change')).toEqual([[{ chaptersRead: 158 }]])
    })
  })

  it('note de 1 à 10 et revient à « pas de note » à 0', async () => {
    const rated = await mountProgress({ rating: 1 })
    await rated.get('[aria-label="Diminuer : Ma note"]').trigger('click')
    expect(rated.emitted('change')).toEqual([[{ rating: null }]])

    const unrated = await mountProgress({ rating: null })
    expect(unrated.get('input[aria-label="Ma note"]').element).toHaveProperty('value', '—')
    await unrated.get('[aria-label="Augmenter : Ma note"]').trigger('click')
    expect(unrated.emitted('change')).toEqual([[{ rating: 1 }]])
  })

  it('efface une date vidée et enregistre une date saisie', async () => {
    const wrapper = await mountProgress()

    await wrapper.get('[data-testid="library-started"]').setValue('')
    await wrapper.get('[data-testid="library-finished"]').setValue('2026-02-03')

    expect(wrapper.emitted('change')).toEqual([
      [{ startedOn: null }],
      [{ finishedOn: '2026-02-03' }],
    ])
  })

  it('avertit sans bloquer au-delà du total connu', async () => {
    const wrapper = await mountProgress({ chaptersRead: 130 }, { chapters: 120, volumes: null })

    const warnings = wrapper.findAll('[data-testid="library-warning"]')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.text()).toContain('120')
  })
})
