<script setup lang="ts">
/**
 * Confirmation of a sensitive action; `cancelLabel` is the safe outcome (change nothing).
 * `cancel` tells the decline button apart from the cross, Escape and a click outside (which only close).
 */
defineProps<{
  title: string
  text: string
  confirmLabel: string
  cancelLabel: string
  closeLabel: string
  /** Destructive action (archiving…): red confirm button. */
  danger?: boolean
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const open = defineModel<boolean>({ default: false })
const narrow = useNarrowScreen()

/** Closes the dialog and reports the confirmation. */
function confirm() {
  open.value = false
  emit('confirm')
}

/** Closes the dialog and reports the explicit refusal. */
function cancel() {
  open.value = false
  emit('cancel')
}
</script>

<template>
  <UiModal
    v-model="open"
    plain
    :danger="danger"
    :title="title"
    :close-label="closeLabel"
    :placement="narrow ? 'bottom' : 'center'"
  >
    <div class="confirm">
      <p class="confirm__text">{{ text }}</p>
      <slot />
      <div class="confirm__actions">
        <UiButton
          variant="secondary"
          class="confirm__button"
          data-testid="confirm-cancel"
          @click="cancel"
        >
          {{ cancelLabel }}
        </UiButton>
        <UiButton
          :variant="danger ? 'danger-solid' : 'primary'"
          class="confirm__button"
          data-testid="confirm-accept"
          @click="confirm"
        >
          {{ confirmLabel }}
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>

<style scoped lang="scss">
.confirm__text {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  line-height: 1.5;
}

// Both buttons always stay side by side, at equal width; a long label wraps onto two
// lines inside its button rather than sending one button under the other.
.confirm__actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.confirm__button {
  flex: 1 1 0;
  min-width: 0;
  padding-inline: var(--space-2);
  text-align: center;
  text-wrap: balance;
}
</style>
