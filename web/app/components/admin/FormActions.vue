<script setup lang="ts">
// Pied commun des formulaires du catalogue : erreur de l'API, « Enregistrer » (vert) et « Annuler »,
// qui ramène à la liste où l'on était.
defineProps<{ errorKey?: string; saving: boolean }>()
const { t } = useI18n()
const { location } = useAdminListLocation()
</script>

<template>
  <div class="actions">
    <p v-if="errorKey" class="actions__error" role="alert">{{ t(errorKey) }}</p>
    <div class="actions__buttons">
      <UiButton type="submit" variant="success" :disabled="saving" data-testid="admin-save">
        {{ t('admin.save') }}
      </UiButton>
      <UiButton variant="secondary" :to="location" data-testid="admin-cancel">
        {{ t('admin.cancel') }}
      </UiButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.actions {
  display: grid;
  gap: var(--space-3);
}

.actions__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.actions__error {
  margin: 0;
  color: var(--color-crimson);
  font-weight: 700;
}
</style>
