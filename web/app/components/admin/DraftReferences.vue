<script setup lang="ts">
import type { DraftReference } from '~/utils/admin'

/**
 * Refusal of a publication that cites draft records: names each one, with a link to open it (in a
 * new tab, so the unsaved form stays). Shows nothing without references.
 */
defineProps<{ references: readonly DraftReference[] }>()
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <div v-if="references.length > 0" class="drafts" data-testid="draft-references">
    <UiFormError>{{
      t('admin.draftReferences.title', { count: references.length }, references.length)
    }}</UiFormError>
    <p class="drafts__hint">
      {{ t('admin.draftReferences.hint', { count: references.length }, references.length) }}
    </p>
    <ul class="drafts__list">
      <li v-for="reference in references" :key="`${reference.kind}-${reference.id}`">
        <span class="drafts__kind">{{ t(`admin.draftReferences.kind.${reference.kind}`) }} ·</span>
        <NuxtLink
          :to="localePath(adminEditPath(reference.kind, reference.id))"
          class="link-underlined"
          target="_blank"
          rel="noopener"
          :aria-label="t('admin.draftReferences.open', { name: reference.label })"
        >
          {{ reference.label }}
          <Icon name="tabler:external-link" size="16" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.drafts {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border);
  border-color: var(--color-crimson);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.drafts__hint {
  margin: 0;
  color: var(--color-crimson);
}

.drafts__list {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
}

.drafts__kind {
  margin-right: var(--space-1);
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}
</style>
