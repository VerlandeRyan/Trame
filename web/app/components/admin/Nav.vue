<script setup lang="ts">
// Barre de l'administration (maquette 22) : seul le catalogue existe, les autres entrées sont
// visibles mais inactives en attendant leur ticket.
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
// Bande blanche pleine largeur sous l'en-tête : elle annule les marges de `<main>` comme l'accueil.
.admin-nav {
  display: flex;
  gap: 0;
  margin: calc(-1 * var(--main-pad-top)) calc(-1 * var(--main-pad-x)) var(--space-2);
  padding: var(--space-1) var(--main-pad-x) 0;
  border-bottom: var(--border);
  background: var(--color-surface);
}

.admin-nav__item {
  display: inline-flex;
  align-items: center;
  min-height: calc(var(--touch) + var(--space-2));
  min-width: 0;
  // Au mobile les trois entrées doivent tenir dans la largeur, sans faire défiler la page.
  padding: 0 var(--space-2);
  border: 0;
  border-bottom: var(--border);
  border-color: transparent;
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-weight: 800;
  text-decoration: none;

  @media (min-width: 768px) {
    padding: 0 var(--space-4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.admin-nav__item--current {
  border-color: var(--color-blue);
  color: var(--color-blue);
}
</style>
