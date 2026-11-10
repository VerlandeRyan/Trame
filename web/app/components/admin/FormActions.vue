<script setup lang="ts">
/** Common footer of the catalogue forms: API error, "Save" (green) and "Cancel", which goes back to the list the user came from. */
defineProps<{ errorKey?: string; saving: boolean }>()
const { t } = useI18n()
const { location } = useAdminListLocation()
</script>

<template>
  <div class="actions">
    <UiFormError v-if="errorKey">{{ t(errorKey) }}</UiFormError>
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
</style>
