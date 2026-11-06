<script setup lang="ts">
import type { LibraryEntry, LibraryStatus } from '~/utils/library'

// Bouton unique au-dessus de « Lire / Acheter » (maquettes de la fiche œuvre) :
// « Ajouter à ma liste + » tant que l'œuvre n'y est pas, puis le statut dans sa couleur, qui ouvre
// le menu des statuts et « Retirer de ma liste ».
defineProps<{
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

const confirmingRemoval = ref(false)

function askRemoval(closeMenu: () => void) {
  closeMenu()
  confirmingRemoval.value = true
}
</script>

<template>
  <div class="status-menu" data-testid="library-status-menu">
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

    <LibraryStatusList
      v-else
      block
      :status="entry.status"
      testid-prefix="library-status"
      @change="emit('changeStatus', $event)"
    >
      <template #trigger="{ isOpen, menuId, toggle }">
        <UiButton
          block
          :status="entry.status"
          aria-haspopup="menu"
          :aria-expanded="isOpen"
          :aria-controls="menuId"
          class="status-menu__trigger"
          data-testid="library-status"
          @click="toggle"
        >
          {{ t(`readingStatus.${entry.status}`) }}
          <Icon name="tabler:chevron-down" size="16" aria-hidden="true" />
        </UiButton>
      </template>
      <template #footer="{ close }">
        <button
          type="button"
          class="status-list__item status-list__item--danger"
          role="menuitem"
          data-testid="library-remove"
          @click="askRemoval(close)"
        >
          <Icon name="tabler:trash" size="16" aria-hidden="true" class="status-list__check" />
          {{ t('library.remove') }}
        </button>
      </template>
    </LibraryStatusList>

    <UiFormError v-if="errorKey" data-testid="library-error">{{ t(errorKey) }}</UiFormError>

    <LibraryRemoveConfirm v-model="confirmingRemoval" @confirm="emit('remove')" />
  </div>
</template>

<style scoped lang="scss">
.status-menu {
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
</style>
