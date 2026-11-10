<script setup lang="ts">
import type { ReadingTotals } from '~/utils/reading-list'

/**
 * Reading totals of the list. The two totals stay separate, never added together. Two cards on
 * desktop, a discreet line on mobile (the cards stay in the page, hidden, for screen readers).
 */
defineProps<{ totals: ReadingTotals }>()
const { t, n } = useI18n()
</script>

<template>
  <div class="summary" data-testid="list-summary">
    <dl class="summary__totals">
      <div class="summary__total" data-testid="list-total-chapters">
        <dt class="summary__label">{{ t('counter.chapters.label') }}</dt>
        <dd class="summary__value">{{ n(totals.chaptersRead) }}</dd>
      </div>
      <div class="summary__total" data-testid="list-total-volumes">
        <dt class="summary__label">{{ t('counter.volumes.label') }}</dt>
        <dd class="summary__value">{{ n(totals.volumesRead) }}</dd>
      </div>
    </dl>
    <p class="summary__line" aria-hidden="true" data-testid="list-totals-line">
      {{
        t('list.totalsLine', {
          chapters: t('list.chaptersCount', { count: n(totals.chaptersRead) }, totals.chaptersRead),
          volumes: t('list.volumesCount', { count: n(totals.volumesRead) }, totals.volumesRead),
        })
      }}
    </p>
    <p class="summary__note">{{ t('list.neverAdded') }}</p>
  </div>
</template>

<style scoped lang="scss">
.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-4);
}

// Mobile: only the line is visible; the cards (and the explanatory sentence) stay readable by screen readers.
.summary__totals {
  display: grid;
  flex: 1 1 18rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  max-width: 24rem;
  margin: 0;

  @media (max-width: 767px) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

.summary__total {
  padding: var(--space-2) var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-small);
  background: var(--color-surface);
}

.summary__label {
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 700;
}

.summary__value {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 800;
}

.summary__line {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 700;

  @media (min-width: 768px) {
    display: none;
  }
}

.summary__note {
  flex: 1 1 12rem;
  max-width: 18rem;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;

  @media (max-width: 767px) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
