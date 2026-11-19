<script setup lang="ts">
import type { FormMode } from '~/utils/admin'

/**
 * Common footer of the catalogue forms: API error, "Save" (green), "Publish" for a new record or a
 * draft (the first one saves as a draft) and "Cancel", which goes back to the list the user came from.
 */
const props = withDefaults(defineProps<{ errorKey?: string; saving: boolean; mode?: FormMode }>(), {
  errorKey: undefined,
  mode: 'published',
})
const emit = defineEmits<{ publish: [] }>()
const { t } = useI18n()
const { location } = useAdminListLocation()
const canPublish = computed(() => props.mode !== 'published')
</script>

<template>
  <div class="actions">
    <UiFormError v-if="errorKey">{{ t(errorKey) }}</UiFormError>
    <div class="actions__buttons">
      <UiButton type="submit" variant="success" :disabled="saving" data-testid="admin-save">
        {{ t(mode === 'create' ? 'admin.saveDraft' : 'admin.save') }}
      </UiButton>
      <UiButton
        v-if="canPublish"
        type="button"
        variant="primary"
        :disabled="saving"
        data-testid="admin-publish"
        @click="emit('publish')"
      >
        {{ t('admin.publish') }}
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

  // On a phone the buttons stack at full width: wrapped side by side they ended up misaligned.
  @media (max-width: 767px) {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
