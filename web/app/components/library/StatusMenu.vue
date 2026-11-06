<script setup lang="ts">
import { LIBRARY_STATUSES, type LibraryEntry, type LibraryStatus } from '~/utils/library'

// Bouton unique au-dessus de « Lire / Acheter » (maquettes de la fiche œuvre) :
// « Ajouter à ma liste + » tant que l'œuvre n'y est pas, puis le statut dans sa couleur, qui ouvre
// le menu des statuts et « Retirer de ma liste ».
const props = defineProps<{
  entry: LibraryEntry | null
  isSignedIn: boolean
  /** Faux tant que l'entrée n'est pas lue : on ne propose pas d'ajouter une œuvre déjà suivie. */
  isLoaded: boolean
  isBusy: boolean
  errorKey: string | null
}>()
const emit = defineEmits<{ add: []; changeStatus: [status: LibraryStatus]; remove: [] }>()
const { t } = useI18n()
const signInOpen = useSignInModal()

const root = ref<HTMLElement | null>(null)
const trigger = ref<{ $el: HTMLElement } | null>(null)
const { isOpen, close } = useDismissableMenu(root, () => trigger.value?.$el.focus())
const menuId = useId()
const confirmingRemoval = ref(false)

function chooseStatus(status: LibraryStatus) {
  close({ restoreFocus: true })
  if (status !== props.entry?.status) emit('changeStatus', status)
}

function askRemoval() {
  close()
  confirmingRemoval.value = true
}
</script>

<template>
  <div ref="root" class="status-menu" data-testid="library-status-menu">
    <UiButton
      v-if="!isSignedIn"
      block
      class="status-menu__add"
      data-testid="library-sign-in"
      @click="signInOpen = true"
    >
      {{ t('action.addToList') }} +
    </UiButton>

    <!-- Entrée pas encore lue : ni « Ajouter » ni statut, pour ne jamais montrer un faux état. -->
    <div
      v-else-if="!entry && !isLoaded"
      class="status-menu__loading"
      aria-busy="true"
      data-testid="library-loading"
    />

    <UiButton
      v-else-if="!entry"
      block
      class="status-menu__add"
      :disabled="isBusy"
      data-testid="library-add"
      @click="emit('add')"
    >
      {{ t('action.addToList') }} +
    </UiButton>

    <template v-else>
      <UiButton
        ref="trigger"
        block
        :status="entry.status"
        aria-haspopup="menu"
        :aria-expanded="isOpen"
        :aria-controls="menuId"
        class="status-menu__trigger"
        data-testid="library-status"
        @click="isOpen = !isOpen"
      >
        {{ t(`readingStatus.${entry.status}`) }}
        <Icon name="tabler:chevron-down" size="16" aria-hidden="true" />
      </UiButton>

      <div v-show="isOpen" :id="menuId" class="status-menu__panel" role="menu">
        <button
          v-for="status in LIBRARY_STATUSES"
          :key="status"
          type="button"
          class="status-menu__item"
          role="menuitemradio"
          :aria-checked="status === entry.status"
          :data-testid="`library-status-${status}`"
          @click="chooseStatus(status)"
        >
          <Icon
            v-if="status === entry.status"
            name="tabler:check"
            size="16"
            aria-hidden="true"
            class="status-menu__check"
          />
          <span v-else class="status-menu__check" aria-hidden="true" />
          <span
            class="status-menu__dot"
            :style="{ background: `var(--status-${status})` }"
            aria-hidden="true"
          />
          {{ t(`readingStatus.${status}`) }}
        </button>
        <hr class="status-menu__separator" />
        <button
          type="button"
          class="status-menu__item status-menu__item--danger"
          role="menuitem"
          data-testid="library-remove"
          @click="askRemoval"
        >
          <Icon name="tabler:trash" size="16" aria-hidden="true" class="status-menu__check" />
          {{ t('library.remove') }}
        </button>
      </div>
    </template>

    <p v-if="errorKey" class="status-menu__error" role="alert" data-testid="library-error">
      {{ t(errorKey) }}
    </p>

    <LibraryRemoveConfirm v-model="confirmingRemoval" @confirm="emit('remove')" />
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.status-menu {
  position: relative;
  display: grid;
  gap: var(--space-2);
}

// Même encombrement que le bouton, pour que la page ne bouge pas quand l'état arrive.
.status-menu__loading {
  min-height: var(--touch);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-field-soft);
}

// Libellés plus petits que le texte courant (12 px dans la maquette). Une seule ligne : « + » ne
// doit jamais passer sous le libellé.
.status-menu__add,
.status-menu__trigger {
  font-size: 0.8125rem;
  font-weight: 800;
  white-space: nowrap;
}

.status-menu__panel {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  left: 0;
  z-index: 20;
  overflow: hidden;
  border: var(--border);
  border-color: var(--color-blue);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow);
}

// Style unique des menus de choix : lignes pleine largeur séparées d'un pointillé, choix courant
// en bleu plein avec la coche à gauche.
.status-menu__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;

  // Le survol et l'appui ne changent pas le choix courant (bleu plein).
  &:not([aria-checked='true'], .status-menu__item--danger) {
    @include on-hover {
      background: var(--color-cover-empty);
    }

    @include press-background(var(--color-cover-empty));
  }

  & + & {
    border-top: 1px dashed var(--color-rule);
  }

  &[aria-checked='true'] {
    background: var(--color-blue);
    color: var(--color-surface);
  }
}

// Texte rouge : survol rose pâle, comme « Archiver » (conventions § survol et appui).
.status-menu__item--danger {
  color: var(--color-crimson);

  @include on-hover {
    background: var(--color-chip);
  }

  @include press-background(var(--color-chip));
}

.status-menu__dot {
  flex: none;
  width: 14px;
  height: 14px;
  border: var(--border);
  border-radius: 50%;
}

.status-menu__check {
  display: inline-block;
  flex: none;
  width: 16px;
}

// Trait plein : l'action de retrait se détache des statuts.
.status-menu__separator {
  margin: 0;
  border: 0;
  border-top: var(--border);
  border-top-color: var(--color-blue);
}

.status-menu__error {
  margin: 0;
  color: var(--color-crimson);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
