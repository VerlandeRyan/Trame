<script setup lang="ts" generic="T">
/**
 * List of editable rows: a row's content comes from the slot, adding and removing are emitted
 * (the parent holds the array).
 * `columns`: CSS columns of a row's fields from tablet width; one column below.
 * `rowLabel`: each row becomes a card with a header ("Title 1" and the remove button); without it,
 * the remove button sits to the right of the fields.
 * `isFilled`: a row that answers true asks for confirmation before being removed; without it (or
 * for an empty row) the removal is immediate.
 */
const props = defineProps<{
  items: T[]
  addLabel: string
  removeLabel: string
  columns?: string
  rowLabel?: string
  isFilled?: (item: T) => boolean
}>()
const emit = defineEmits<{ add: []; remove: [index: number] }>()
const isConfirming = ref(false)
// Kept after the modal closes: it closes before emitting "confirm".
const pendingIndex = ref(0)

/** Removes the row at once, or asks for confirmation if it is filled in. */
function requestRemove(index: number) {
  if (props.isFilled?.(props.items[index] as T)) {
    pendingIndex.value = index
    isConfirming.value = true
  } else {
    emit('remove', index)
  }
}
</script>

<template>
  <div class="row-list">
    <ul v-if="items.length > 0" class="row-list__rows">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="row-list__row"
        :class="{ 'row-list__row--card': rowLabel }"
        data-testid="row-list-row"
      >
        <span v-if="rowLabel" class="row-list__label" data-testid="row-list-label">
          {{ rowLabel }} {{ index + 1 }}
        </span>
        <div class="row-list__fields" :style="{ '--row-columns': columns ?? '1fr' }">
          <slot :item="item" :index="index" />
        </div>
        <UiButton
          variant="secondary"
          size="small"
          class="row-list__remove"
          :aria-label="removeLabel"
          data-testid="row-list-remove"
          @click="requestRemove(index)"
        >
          <Icon name="tabler:x" size="16" aria-hidden="true" />
        </UiButton>
      </li>
    </ul>
    <UiButton
      variant="secondary"
      size="small"
      class="row-list__add"
      data-testid="row-list-add"
      @click="emit('add')"
    >
      <Icon name="tabler:plus" size="16" aria-hidden="true" />{{ addLabel }}
    </UiButton>
    <AdminRowRemoveConfirm
      v-if="isFilled"
      v-model="isConfirming"
      @confirm="emit('remove', pendingIndex)"
    />
  </div>
</template>

<style scoped lang="scss">
.row-list {
  display: grid;
  gap: var(--space-3);
}

.row-list__rows {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
}

.row-list__row {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  padding-bottom: var(--space-3);
  border-bottom: 1px dashed var(--color-ink-soft);
}

.row-list__fields {
  display: grid;
  flex: 1;
  gap: var(--space-3);
  min-width: 0;

  @media (min-width: 768px) {
    grid-template-columns: var(--row-columns);
    align-items: end;
  }
}

.row-list__remove {
  flex: none;
  align-self: flex-end;
  min-width: var(--touch);
  padding-inline: 0;
}

// Card: header (label on the left, remove on the right), then the fields over the full width.
.row-list__row--card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border: 2px dashed var(--color-ink-soft);
  border-radius: var(--radius);
  background: var(--color-row-card);

  .row-list__fields {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .row-list__remove {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
  }
}

.row-list__label {
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.row-list__add {
  justify-self: start;
}
</style>
