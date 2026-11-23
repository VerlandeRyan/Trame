<script setup lang="ts">
import type { FormMode } from '~/utils/admin'

/**
 * Common footer of the catalogue forms: API error, "Save" (green; "Save and republish" in pink on a
 * published record, which edits the public version), "Publish" for a new record or a draft (the
 * first one saves as a draft) and "Cancel", which goes back to the list the user came from.
 */
const props = withDefaults(defineProps<{ errorKey?: string; saving: boolean; mode?: FormMode }>(), {
  errorKey: undefined,
  mode: 'published',
})
const emit = defineEmits<{ publish: [] }>()
const { t } = useI18n()
const { location } = useAdminListLocation()
const isPublished = computed(() => props.mode === 'published')
const canPublish = computed(() => props.mode === 'create' || props.mode === 'draft')
const saveKey = computed(() => {
  if (props.mode === 'create') return 'admin.saveDraft'
  return isPublished.value ? 'admin.saveRepublish' : 'admin.save'
})
</script>

<template>
  <div class="actions">
    <UiFormError v-if="errorKey">{{ t(errorKey) }}</UiFormError>
    <div class="actions__buttons">
      <UiButton
        type="submit"
        :variant="isPublished ? 'primary' : 'success'"
        :disabled="saving"
        data-testid="admin-save"
      >
        {{ t(saveKey) }}
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
    <p v-if="isPublished" class="actions__hint" data-testid="admin-republish-hint">
      {{ t('admin.republishHint') }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.actions {
  display: grid;
  gap: var(--space-3);
}

.actions__hint {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
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
