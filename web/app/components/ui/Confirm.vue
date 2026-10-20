<script setup lang="ts">
// Confirmation d'une action sensible ; `cancelLabel` est l'issue sûre (ne rien changer).
defineProps<{
  title: string
  text: string
  confirmLabel: string
  cancelLabel: string
  closeLabel: string
}>()
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>({ default: false })
const narrow = useNarrowScreen()

function confirm() {
  open.value = false
  emit('confirm')
}
</script>

<template>
  <UiModal
    v-model="open"
    plain
    :title="title"
    :close-label="closeLabel"
    :placement="narrow ? 'bottom' : 'center'"
  >
    <div class="confirm">
      <p class="confirm__text">{{ text }}</p>
      <div class="confirm__actions">
        <UiButton variant="secondary" data-testid="confirm-cancel" @click="open = false">
          {{ cancelLabel }}
        </UiButton>
        <UiButton data-testid="confirm-accept" @click="confirm">{{ confirmLabel }}</UiButton>
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

.confirm__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-4);
}
</style>
