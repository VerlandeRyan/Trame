<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { pageItems } from '~/utils/search'

// Par liens : l'adresse porte la page (partageable, fonctionne sans script).
const props = defineProps<{
  page: number
  pages: number
  linkFor: (page: number) => RouteLocationRaw
}>()
const { t } = useI18n()
const items = computed(() => pageItems(props.page, props.pages))
</script>

<template>
  <nav v-if="pages > 1" class="pagination" :aria-label="t('search.pagination')">
    <ul class="pagination__list">
      <li>
        <NuxtLink
          v-if="page > 1"
          :to="linkFor(page - 1)"
          rel="prev"
          class="pagination__item pagination__item--wide"
          data-testid="pagination-previous"
        >
          <Icon name="tabler:chevron-left" size="16" aria-hidden="true" />
          <span class="pagination__text">{{ t('search.previous') }}</span>
          <span class="pagination__sr">{{ t('search.previous') }}</span>
        </NuxtLink>
      </li>
      <li v-for="(item, index) in items" :key="`${item}-${index}`">
        <span v-if="item === 'gap'" class="pagination__gap" aria-hidden="true">…</span>
        <span
          v-else-if="item === page"
          class="pagination__item pagination__item--current"
          aria-current="page"
        >
          {{ item }}
        </span>
        <NuxtLink
          v-else
          :to="linkFor(item)"
          class="pagination__item"
          :aria-label="t('search.page', { page: item })"
        >
          {{ item }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink
          v-if="page < pages"
          :to="linkFor(page + 1)"
          rel="next"
          class="pagination__item pagination__item--wide"
          data-testid="pagination-next"
        >
          <span class="pagination__text">{{ t('search.next') }}</span>
          <span class="pagination__sr">{{ t('search.next') }}</span>
          <Icon name="tabler:chevron-right" size="16" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped lang="scss">
.pagination__list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 0;
  padding: 0;
}

.pagination__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-width: var(--touch);
  min-height: var(--touch);
  padding: 0 var(--space-2);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;

  @media (min-width: 768px) {
    min-width: 0;
    min-height: 0;
    padding: 4px 11px;
  }
}

.pagination__item--current {
  background: var(--color-blue);
  color: var(--color-surface);
}

.pagination__gap {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch);
  padding: 0 var(--space-1);
  color: var(--color-ink-soft);

  @media (min-width: 768px) {
    min-height: 0;
  }
}

// Mobile : chevrons, le texte reste lu par les lecteurs d'écran.
.pagination__text {
  display: none;
}

.pagination__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (min-width: 768px) {
  .pagination__text {
    display: inline;
  }

  .pagination__sr {
    display: none;
  }
}
</style>
