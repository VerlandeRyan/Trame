<script setup lang="ts">
/** Administration bar: only the catalogue exists, the other entries are visible but inactive for now. */
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <nav class="admin-nav" :aria-label="t('nav.admin.title')">
    <button type="button" class="admin-nav__item" disabled data-testid="admin-nav-submissions">
      {{ t('nav.admin.submissions') }}
    </button>
    <NuxtLink
      :to="localePath('/admin/catalogue')"
      class="admin-nav__item admin-nav__item--current"
      aria-current="page"
      data-testid="admin-nav-catalogue"
    >
      {{ t('nav.admin.catalogue') }}
    </NuxtLink>
    <button type="button" class="admin-nav__item" disabled data-testid="admin-nav-reports">
      {{ t('nav.admin.reports') }}
    </button>
  </nav>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Full-width white band under the header: it cancels `<main>`'s margins, like the home page.
.admin-nav {
  display: flex;
  gap: 0;
  margin: calc(-1 * var(--main-pad-top)) calc(-1 * var(--main-pad-x)) var(--space-2);
  padding: var(--space-1) var(--main-pad-x) 0;
  background: var(--color-surface);

  @include underline-tab-bar;
}

.admin-nav__item {
  display: inline-flex;
  align-items: center;
  min-height: calc(var(--touch) + var(--space-2));
  min-width: 0;
  // On mobile the three entries share the width (from 320 px) without making the page scroll.
  flex: 1 1 auto;
  justify-content: center;
  padding: 0 var(--space-1);
  color: var(--color-ink);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;

  @include underline-tab('admin-nav__item--current');

  @media (min-width: 768px) {
    flex: 0 1 auto;
    font-size: 1rem;
    padding: 0 var(--space-4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
