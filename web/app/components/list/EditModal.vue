<script setup lang="ts">
import {
  RATING_MAX,
  type LibraryEntry,
  type LibraryEntryChanges,
  type LibraryStatus,
} from '~/utils/library'
import type { ListedEntry } from '~/utils/reading-list'
import { translatedCode } from '~/utils/search'
import { coverUrl } from '~/utils/work'

// « Modifier ma lecture » : statut, compteurs, note et dates d'une œuvre, enregistrés ensemble.
const props = defineProps<{ item: ListedEntry | null }>()
const emit = defineEmits<{ save: [changes: LibraryEntryChanges]; remove: [] }>()
const open = defineModel<boolean>({ default: false })
const { t, te } = useI18n()

const NO_RATING = 0

interface Draft {
  status: LibraryStatus
  chaptersRead: number
  volumesRead: number
  rating: number
  startedOn: string
  finishedOn: string
}

const draft = reactive<Draft>({
  status: 'plan_to_read',
  chaptersRead: 0,
  volumesRead: 0,
  rating: NO_RATING,
  startedOn: '',
  finishedOn: '',
})
const confirmingRemoval = ref(false)

/** Le brouillon de saisie qui reproduit l'entrée telle qu'elle est enregistrée. */
function createDraftFromEntry(entry: LibraryEntry): Draft {
  return {
    status: entry.status,
    chaptersRead: entry.chaptersRead,
    volumesRead: entry.volumesRead,
    rating: entry.rating ?? NO_RATING,
    startedOn: entry.startedOn ?? '',
    finishedOn: entry.finishedOn ?? '',
  }
}

// Le brouillon repart de l'entrée à chaque ouverture.
watch(open, (isOpen) => {
  if (isOpen && props.item) Object.assign(draft, createDraftFromEntry(props.item.entry))
})

const ratingOptions = computed(() =>
  [NO_RATING, ...Array.from({ length: RATING_MAX }, (_, index) => index + 1)].map((rating) => ({
    value: String(rating),
    label:
      rating === NO_RATING
        ? t('library.noRating')
        : t('list.ratingLabel', { rating, name: t(`list.ratingNames.${rating}`) }),
  })),
)
const ratingChoice = computed({
  get: () => String(draft.rating),
  set: (value: string) => {
    draft.rating = Number(value)
  },
})

const publishedTotalLabel = (total: number | null) =>
  total === null ? t('library.ofUnknown') : t('library.of', { total })
const kindLine = computed(() =>
  props.item
    ? [
        t(`workType.${props.item.work.type}`),
        ...props.item.work.formats.map((code) => translatedCode(t, te, 'genre', code)),
        t(`readingStatus.${props.item.entry.status}`),
      ].join(' · ')
    : '',
)

/** Ce que le brouillon change par rapport à l'entrée : seuls les champs modifiés (une date vide l'efface). */
function changesMadeInDraft(entry: LibraryEntry): LibraryEntryChanges {
  const initial = createDraftFromEntry(entry)
  const changes: LibraryEntryChanges = {}
  if (draft.status !== initial.status) changes.status = draft.status
  if (draft.chaptersRead !== initial.chaptersRead) changes.chaptersRead = draft.chaptersRead
  if (draft.volumesRead !== initial.volumesRead) changes.volumesRead = draft.volumesRead
  if (draft.rating !== initial.rating)
    changes.rating = draft.rating === NO_RATING ? null : draft.rating
  if (draft.startedOn !== initial.startedOn) changes.startedOn = draft.startedOn || null
  if (draft.finishedOn !== initial.finishedOn) changes.finishedOn = draft.finishedOn || null
  return changes
}

function saveChangesAndClose() {
  if (!props.item) return
  const changes = changesMadeInDraft(props.item.entry)
  // Avant de fermer : la fermeture fait oublier l'œuvre à la page.
  if (Object.keys(changes).length > 0) emit('save', changes)
  open.value = false
}

function removeFromListAndClose() {
  emit('remove')
  open.value = false
}
</script>

<template>
  <UiModal
    v-model="open"
    plain
    class="edit-modal"
    :title="t('list.modalTitle')"
    :close-label="t('action.close')"
  >
    <div v-if="item" class="edit" data-testid="list-edit-modal">
      <div class="edit__work">
        <WorkCover :url="coverUrl(item.work.coverPath)" size="small" />
        <div>
          <p class="edit__title">{{ item.work.title }}</p>
          <p class="edit__kind">{{ kindLine }}</p>
        </div>
      </div>

      <div class="edit__field">
        <span class="edit__label">{{ t('list.status') }}</span>
        <ListStatusPicker
          :status="draft.status"
          :title="item.work.title"
          @change="draft.status = $event"
        />
      </div>

      <div class="edit__field">
        <span class="edit__label">
          {{ t('library.chaptersRead') }}
          <small>{{ publishedTotalLabel(item.work.chapters) }}</small>
        </span>
        <UiCounter v-model="draft.chaptersRead" compact :label="t('library.chaptersRead')" />
      </div>

      <div class="edit__field">
        <span class="edit__label">
          {{ t('library.volumesRead') }}
          <small>{{ publishedTotalLabel(item.work.volumes) }}</small>
        </span>
        <UiCounter v-model="draft.volumesRead" compact :label="t('library.volumesRead')" />
      </div>

      <div class="edit__field">
        <span class="edit__label">
          {{ t('list.rating') }}
        </span>
        <div class="edit__control">
          <!-- Menu : on choisit la note d'un coup, « — » la retire. -->
          <UiSelect
            v-model="ratingChoice"
            class="edit__rating"
            :options="ratingOptions"
            :label="t('library.rating')"
            prefix=""
            trigger-test-id="list-edit-rating"
          />
          <small class="edit__hint">{{ t('list.ratingHint') }}</small>
        </div>
      </div>

      <label class="edit__field">
        <span class="edit__label">{{ t('library.startedOn') }}</span>
        <input v-model="draft.startedOn" type="date" class="edit__date" />
      </label>

      <label class="edit__field">
        <span class="edit__label">{{ t('library.finishedOn') }}</span>
        <input v-model="draft.finishedOn" type="date" class="edit__date" />
      </label>
    </div>

    <template #footer>
      <div class="edit__footer">
        <button
          type="button"
          class="edit__remove"
          data-testid="list-edit-remove"
          @click="confirmingRemoval = true"
        >
          {{ t('library.remove') }}
        </button>
        <UiButton variant="secondary" size="small" @click="open = false">
          {{ t('list.cancel') }}
        </UiButton>
        <UiButton size="small" data-testid="list-edit-save" @click="saveChangesAndClose">
          {{ t('list.save') }}
        </UiButton>
      </div>
    </template>
  </UiModal>

  <UiConfirm
    v-model="confirmingRemoval"
    :title="t('library.removeTitle')"
    :text="t('library.removeText')"
    :confirm-label="t('library.remove')"
    :cancel-label="t('library.keep')"
    :close-label="t('action.close')"
    @confirm="removeFromListAndClose"
  />
</template>

<style scoped lang="scss">
// Plus large que les fenêtres d'invitation : un formulaire de six lignes.
.edit-modal {
  --modal-width: 720px;
}

.edit {
  display: grid;
  gap: var(--space-2);
}

.edit__work {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
}

.edit__work :deep(.cover) {
  width: 44px;
}

.edit__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 800;
}

.edit__kind {
  margin: 2px 0 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}

// Libellé à gauche, contrôle à droite, séparés par un filet pointillé comme la maquette.
.edit__field {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-top: 1px dashed var(--color-rule);

  @media (min-width: 768px) {
    grid-template-columns: 9rem minmax(0, 1fr);
  }

  :deep(.counter) {
    justify-items: start;
  }
}

.edit__control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

// Menu de la note : cadre de la maquette, la valeur à gauche et la flèche à droite.
.edit__rating {
  display: flex;
  flex: 0 1 13rem;
  min-width: 0;
  padding: 0 var(--space-2);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);

  :deep(.select__trigger) {
    flex: 1;
    justify-content: space-between;
    min-height: 36px;
  }

  // Le menu s'ouvre vers le haut, sur les lignes déjà remplies, et défile : vers le bas il
  // dépasserait la fenêtre et en ferait défiler le corps.
  :deep(.select__menu) {
    inset: auto auto calc(100% + 4px) 0;
    width: max-content;
    min-width: 100%;
    max-width: calc(100vw - 4rem);
    max-height: 13.5rem;
    overflow-y: auto;
  }

  :deep(.select__option) {
    min-height: 32px;
    padding: 0 var(--space-2);
  }
}

.edit__hint {
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
}

// Le libellé de la ligne suffit à l'œil ; celui du compteur reste lu par les lecteurs d'écran.
.edit__field :deep(.counter__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.edit__label {
  display: grid;
  font-size: 0.8125rem;
  font-weight: 700;

  small {
    color: var(--color-ink-soft);
    font-size: 0.6875rem;
    font-weight: 400;
  }
}

.edit__date {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 0 var(--space-2);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  font-size: 0.8125rem;
}

// `flex: 1` : le pied de la fenêtre est un flex, sans cela les boutons restent collés à gauche.
.edit__footer {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.edit__remove {
  margin-right: auto;
  min-height: var(--touch);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-crimson);
  font-size: 0.8125rem;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}
</style>
