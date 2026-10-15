<script setup lang="ts">
// En-tête du site, d'après les maquettes : logo, recherche, langue, connexion.
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <header class="layout-header">
    <NuxtLink :to="localePath('/')" class="layout-header__logo">{{ t('app.name') }}</NuxtLink>
    <div class="layout-header__search">
      <Icon name="tabler:search" size="16" aria-hidden="true" />
      <span class="layout-header__search-label">{{ t('nav.searchPlaceholder') }}</span>
    </div>
    <LayoutLanguageSwitcher class="layout-header__language" />
    <UiButton variant="blue" size="small" class="layout-header__sign-in">
      {{ t('nav.signIn') }}
    </UiButton>
  </header>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.layout-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 22px;
  background: var(--color-rose);
  border-bottom: var(--border);

  // Trame d'encre dense à droite, qui s'estompe vers la gauche.
  &::before {
    @include screentone(var(--color-ink), 6px, 270deg, 55%);
  }

  > * {
    position: relative;
  }
}

.layout-header__logo {
  color: var(--color-ink);
  font-size: 1.375rem;
  font-weight: var(--weight-title);
  text-decoration: none;
}

.layout-header__search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  min-height: var(--touch);
  padding: 0 12px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.layout-header__search-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout-header__sign-in {
  white-space: nowrap;
}

// Mobile : en-tête compact (logo, recherche en icône, langue, compte).
@media (max-width: 767px) {
  .layout-header {
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  // Le logo garde sa largeur ; recherche (icône), langue et compte forment un groupe collé à droite.
  .layout-header__search {
    flex: 0 0 var(--touch);
    justify-content: center;
    margin-left: auto;
    padding: 0;
  }

  .layout-header__search-label {
    display: none;
  }

  // Petits écrans (320–399 px) : tout doit tenir sur une ligne sans défilement horizontal.
  @media (max-width: 399px) {
    .layout-header {
      gap: 6px;
      padding-inline: var(--space-2);
    }

    .layout-header__logo {
      font-size: 1.25rem;
    }

    .layout-header__search {
      flex-basis: 40px;
    }

    .layout-header__language :deep(.language-switcher__trigger) {
      gap: 6px;
      padding-inline: var(--space-2);
    }

    .layout-header__sign-in {
      padding-inline: 10px;
      font-size: 0.75rem;
    }
  }
}
</style>
