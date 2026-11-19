<script setup lang="ts">
/**
 * "⋮" of an archived row on a wide screen: a dropdown with its permanent deletion ("Restore" is
 * already beside it). Focus goes to the entry when it opens and back to "⋮" when it closes.
 */
defineProps<{ label: string }>()
const emit = defineEmits<{ remove: [] }>()
const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const entry = ref<HTMLElement | null>(null)
const { isOpen, close } = useDismissableMenu(root, () => trigger.value?.focus())

/** Opens or closes the menu, putting the focus on its entry when it opens. */
async function toggle() {
  isOpen.value = !isOpen.value
  if (!isOpen.value) return
  await nextTick()
  entry.value?.focus()
}

/** Closes the menu and reports the deletion request. */
function remove() {
  close()
  emit('remove')
}
</script>

<template>
  <div ref="root" class="row-dropdown">
    <button
      ref="trigger"
      type="button"
      class="row-dropdown__trigger"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :aria-label="label"
      data-testid="admin-row-menu"
      @click="toggle"
    >
      <Icon name="tabler:dots-vertical" size="20" aria-hidden="true" />
    </button>
    <div v-if="isOpen" class="row-dropdown__panel" role="menu">
      <button
        ref="entry"
        type="button"
        role="menuitem"
        class="row-dropdown__entry"
        data-testid="admin-dropdown-remove"
        @click="remove"
      >
        <Icon name="tabler:trash" size="16" aria-hidden="true" />{{ t('admin.removeArchived') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.row-dropdown {
  position: relative;
}

.row-dropdown__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch);
  height: var(--touch);
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  cursor: pointer;
}

.row-dropdown__panel {
  @include action-menu-panel;

  width: max-content;
  padding: 4px 16px;

  @include menu-open-animation;
}

.row-dropdown__entry {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-danger);
  font: 800 1rem var(--font-sans);
  text-align: left;
  cursor: pointer;

  @include action-menu-row-highlight(var(--color-chip));
}
</style>
