<script setup lang="ts">
import type { AdminKind, ArchiveImpact } from '~/utils/admin'

/**
 * Archive confirmation, the same from the record and from the list. `impact` (works only) recalls
 * what stays in place: members who follow the work and related works.
 */
defineProps<{ kind: AdminKind; impact?: ArchiveImpact | null }>()
const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()
</script>

<template>
  <UiConfirm
    v-model="open"
    danger
    :title="t('admin.archiveConfirm.title')"
    :text="t(`admin.archiveConfirm.text.${kind}`)"
    :confirm-label="t('admin.archiveConfirm.confirm')"
    :cancel-label="t('admin.archiveConfirm.cancel')"
    :close-label="t('action.close')"
    @confirm="emit('confirm')"
  >
    <dl v-if="impact" class="impact" data-testid="admin-archive-impact">
      <div class="impact__row">
        <dt>{{ t('admin.archiveConfirm.followers') }}</dt>
        <dd>{{ t('admin.archiveConfirm.followersCount', impact.followers) }}</dd>
      </div>
      <div class="impact__row">
        <dt>{{ t('admin.archiveConfirm.relations') }}</dt>
        <dd>{{ t('admin.archiveConfirm.relationsCount', impact.relations) }}</dd>
      </div>
    </dl>
  </UiConfirm>
</template>

<style scoped lang="scss">
// Label on the left, value on the right, light rules.
.impact {
  margin: var(--space-3) 0 0;
  font-size: 0.875rem;
}

.impact__row {
  display: flex;
  gap: var(--space-3);
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-top: 1px solid var(--color-rule);

  dt {
    color: var(--color-ink-soft);
  }

  dd {
    margin: 0;
    font-weight: 700;
    text-align: right;
  }
}
</style>
