<script setup lang="ts">
// Confirmation d'une action sensible ; `cancelLabel` est l'issue sûre (ne rien changer).
// `cancel` distingue le bouton de refus de la croix, d'Échap et du clic à côté (qui ne font que fermer).
defineProps<{
  title: string
  text: string
  confirmLabel: string
  cancelLabel: string
  closeLabel: string
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const open = defineModel<boolean>({ default: false })
const narrow = useNarrowScreen()

function confirm() {
  open.value = false
  emit('confirm')
}

function cancel() {
  open.value = false
  emit('cancel')
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
        <UiButton
          variant="secondary"
          class="confirm__button"
          data-testid="confirm-cancel"
          @click="cancel"
        >
          {{ cancelLabel }}
        </UiButton>
        <UiButton class="confirm__button" data-testid="confirm-accept" @click="confirm">
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

.confirm__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

// Côte à côte, ils se partagent la ligne ; quand les libellés sont longs et qu'ils passent l'un
// sous l'autre, ils prennent la même largeur (sinon l'un est plus étroit et la fenêtre paraît mal alignée).
.confirm__button {
  flex: 1 1 auto;
}
</style>
