<script setup lang="ts">
// Confirmation d'une action sensible ; `cancelLabel` est l'issue sûre (ne rien changer).
// `cancel` distingue le bouton de refus de la croix, d'Échap et du clic à côté (qui ne font que fermer).
defineProps<{
  title: string
  text: string
  confirmLabel: string
  cancelLabel: string
  closeLabel: string
  // Action destructrice (archivage…) : bouton de confirmation rouge.
  danger?: boolean
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

// Les deux boutons restent toujours côte à côte, à largeur égale ; un libellé long passe sur deux
// lignes dans son bouton plutôt que d'envoyer un bouton sous l'autre.
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
