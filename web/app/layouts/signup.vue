<script setup lang="ts">
// Coquille de l'inscription : le logo seul, sans recherche ni compte.
const { t } = useI18n()
const localePath = useLocalePath()
useHtmlLanguage()
</script>

<template>
  <div class="signup-layout">
    <a class="signup-layout__skip-link" href="#contenu">{{ t('nav.skipToContent') }}</a>
    <header class="signup-layout__header">
      <NuxtLink :to="localePath('/')" class="signup-layout__logo">{{ t('app.name') }}</NuxtLink>
    </header>
    <main id="contenu" class="signup-layout__main" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.signup-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.signup-layout__skip-link {
  position: absolute;
  top: -100px;
  left: var(--space-2);
  z-index: 10;
  padding: var(--space-2) var(--space-3);
  border: var(--border);
  background: var(--color-surface);
  font-weight: 700;

  &:focus {
    top: var(--space-2);
  }
}

.signup-layout__header {
  position: relative;
  padding: 12px 22px;
  background: var(--color-rose);
  border-bottom: var(--border);

  // Même trame d'encre que l'en-tête du site.
  &::before {
    @include screentone(var(--color-ink), 6px, 270deg, 55%);
  }

  > * {
    position: relative;
  }
}

.signup-layout__logo {
  color: var(--color-ink);
  font-size: 1.375rem;
  font-weight: var(--weight-title);
  text-decoration: none;
}

.signup-layout__main {
  flex: 1;
  padding: var(--space-6) var(--space-3);

  @media (min-width: 768px) {
    padding: var(--space-8) 22px;
  }

  &:focus-visible {
    outline-offset: -3px;
  }
}
</style>
