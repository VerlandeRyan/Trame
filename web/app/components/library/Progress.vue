<script setup lang="ts">
import {
  exceedsKnownTotal,
  RATING_MAX,
  type LibraryEntry,
  type LibraryEntryChanges,
} from '~/utils/library'

// « Ma progression » (US-06) : chapitres lus, tomes lus et note, puis les dates de lecture
// (repliées : la maquette de la fiche n'en a pas, elles ne doivent pas pousser le synopsis).
// Les deux compteurs sont indépendants (RG-02) ; la note vaut 0 tant qu'on n'a pas noté (« — »).
const props = defineProps<{
  entry: LibraryEntry
  /** Chapitres / tomes parus connus (`null` : inconnu, affiché « ? »). */
  totalChapters: number | null
  totalVolumes: number | null
}>()
const emit = defineEmits<{ change: [changes: LibraryEntryChanges] }>()
const { t } = useI18n()

const titleId = useId()
const NO_RATING = 0

const totalLabel = (total: number | null) =>
  total === null ? t('library.ofUnknown') : t('library.of', { total })

const chaptersExceedTotal = computed(() =>
  exceedsKnownTotal(props.entry.chaptersRead, props.totalChapters),
)
const volumesExceedTotal = computed(() =>
  exceedsKnownTotal(props.entry.volumesRead, props.totalVolumes),
)

// Une progression peut demander de changer le statut (`useReadingPrompt`) ; si rien n'est
// enregistré, le compteur a pu afficher la valeur saisie : on le recrée pour qu'il relise la vraie.
const counterKey = ref(0)
const {
  isOpen: isAskingToRead,
  title: promptTitle,
  text: promptText,
  confirmLabel: promptConfirmLabel,
  cancelLabel: promptCancelLabel,
  request: requestPrompt,
  confirm: confirmPrompt,
  decline: declinePrompt,
} = useReadingPrompt()

function changeProgress(changes: LibraryEntryChanges) {
  const isAsking = requestPrompt(
    props.entry,
    { chapters: props.totalChapters, volumes: props.totalVolumes },
    changes,
    { apply: (confirmed) => emit('change', confirmed), discard: () => (counterKey.value += 1) },
  )
  if (!isAsking) emit('change', changes)
}

const changeRating = (rating: number) =>
  emit('change', { rating: rating === NO_RATING ? null : rating })

function changeDate(field: 'startedOn' | 'finishedOn', event: Event) {
  const date = (event.target as HTMLInputElement).value
  emit('change', { [field]: date === '' ? null : date })
}
</script>

<template>
  <!-- La fenêtre de confirmation reste hors du panneau : `container-type` en ferait son repère. -->
  <div>
    <section class="progress" :aria-labelledby="titleId" data-testid="library-progress">
      <h2 :id="titleId" class="progress__title">{{ t('library.progress') }}</h2>

      <div class="progress__grid">
        <div class="progress__cell">
          <UiCounter
            :key="`chapters-${counterKey}`"
            compact
            :model-value="entry.chaptersRead"
            :label="t('library.chaptersRead')"
            @update:model-value="changeProgress({ chaptersRead: $event })"
          />
          <small class="progress__total">{{ totalLabel(totalChapters) }}</small>
          <small v-if="chaptersExceedTotal" class="progress__warning" data-testid="library-warning">
            {{ t('library.exceedsChapters', { total: totalChapters }) }}
          </small>
        </div>

        <div class="progress__cell">
          <UiCounter
            :key="`volumes-${counterKey}`"
            compact
            :model-value="entry.volumesRead"
            :label="t('library.volumesRead')"
            @update:model-value="changeProgress({ volumesRead: $event })"
          />
          <small class="progress__total">{{ totalLabel(totalVolumes) }}</small>
          <small v-if="volumesExceedTotal" class="progress__warning" data-testid="library-warning">
            {{ t('library.exceedsVolumes', { total: totalVolumes }) }}
          </small>
        </div>

        <div class="progress__cell">
          <UiCounter
            compact
            :model-value="entry.rating ?? NO_RATING"
            :label="t('library.rating')"
            :max="RATING_MAX"
            :empty-label="t('library.noRating')"
            @update:model-value="changeRating"
          />
          <small class="progress__total">{{ t('library.ofTen') }}</small>
        </div>
      </div>

      <details class="progress__dates">
        <summary class="progress__dates-toggle" data-testid="library-dates-toggle">
          {{ t('library.dates') }}
          <Icon name="tabler:chevron-down" size="14" aria-hidden="true" />
        </summary>
        <div class="progress__dates-fields">
          <label class="progress__date">
            {{ t('library.startedOn') }}
            <input
              type="date"
              class="progress__date-input"
              :value="entry.startedOn ?? ''"
              data-testid="library-started"
              @change="changeDate('startedOn', $event)"
            />
          </label>
          <label class="progress__date">
            {{ t('library.finishedOn') }}
            <input
              type="date"
              class="progress__date-input"
              :value="entry.finishedOn ?? ''"
              data-testid="library-finished"
              @change="changeDate('finishedOn', $event)"
            />
          </label>
        </div>
      </details>
    </section>

    <UiConfirm
      v-model="isAskingToRead"
      :title="promptTitle"
      :text="promptText"
      :confirm-label="promptConfirmLabel"
      :cancel-label="promptCancelLabel"
      :close-label="t('action.close')"
      @confirm="confirmPrompt"
      @cancel="declinePrompt"
    />
  </div>
</template>

<style scoped lang="scss">
// Cotes de la maquette : panneau blanc à ombre, titre de 13 px, trois colonnes séparées par un
// filet, toujours côte à côte. Étroit, les compteurs se resserrent (le panneau décide, pas l'écran).
.progress {
  container-type: inline-size;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

.progress__title {
  padding: 9px var(--space-3) 0;
  font-size: 0.8125rem;
  font-weight: 800;
}

.progress__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.progress__cell {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1) var(--space-3);
  text-align: center;

  & + & {
    border-left: var(--border);
  }
}

@container (max-width: 26rem) {
  .progress__grid {
    --counter-gap: 4px;
    --counter-value-width: 2.5rem;
  }
}

@container (max-width: 20rem) {
  .progress__grid {
    --counter-value-width: 2rem;
  }
}

.progress__total {
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
}

.progress__warning {
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
  font-weight: 700;
}

.progress__dates {
  border-top: var(--border);
}

.progress__dates-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--touch);
  padding: 0 var(--space-3);
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
  font-weight: 700;
  cursor: pointer;
}

// Les deux dates côte à côte, même à 320 px : une seule rangée au lieu de deux.
.progress__dates-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  padding: 0 var(--space-2) var(--space-2);
}

.progress__date {
  display: grid;
  min-width: 0;
  gap: 2px;
  font-size: 0.625rem;
  font-weight: 700;
}

// Champs discrets : 32 px de haut, texte de 13 px (un `<input type="date">` ouvre un sélecteur
// natif, il ne déclenche pas le zoom de Safari iOS comme un champ de texte).
.progress__date-input {
  min-width: 0;
  min-height: 32px;
  padding: 0 var(--space-1);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  font-size: 0.8125rem;
}
</style>
