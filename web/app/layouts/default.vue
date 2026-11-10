<script setup lang="ts">
/** Default layout: header, page content and the screentone column on the right edge. */
const { t } = useI18n()
const route = useRoute()

useHtmlLanguage()
</script>

<template>
  <div class="layout">
    <a class="layout__skip-link" href="#contenu">{{ t('nav.skipToContent') }}</a>
    <LayoutHeader />
    <AuthNotice />
    <AuthSignInModal />
    <!-- Decoration: pink dot screentone on the right edge, under the header, behind the content. -->
    <div v-if="route.meta.trame !== 'hero'" class="layout__trame" aria-hidden="true" />
    <main id="contenu" class="layout__main" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
// The content stretches: `<main>`'s focus outline surrounds the whole page.
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

// Same side margins as the header. They are variables: the home page cancels them for its bands.
.layout__main {
  --main-pad-top: var(--space-4);
  --main-pad-x: var(--space-3);
  --main-pad-bottom: var(--space-6);

  // Above the decorative screentone (`z-index` 0).
  position: relative;
  z-index: 1;
  flex: 1;
  padding: var(--main-pad-top) var(--main-pad-x) var(--main-pad-bottom);

  @media (min-width: 768px) {
    --main-pad-top: 26px;
    --main-pad-x: 22px;
    --main-pad-bottom: 30px;
  }

  // `<main>` is not a control: an empty click or the skip link focuses it, but its
  // outline (a line on the page edge) adds nothing.
  &:focus-visible {
    outline: none;
  }
}

// Pink screentone on the right edge, fixed while scrolling, fading to the left and bottom.
// Decoration: no clicks, hidden from screen readers.
.layout__trame {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  width: 24%;
  background-image: radial-gradient(circle, var(--color-trame-side) 36%, transparent 42%);
  background-size: 7px 7px;
  opacity: 0.23;
  pointer-events: none;
  -webkit-mask-image:
    linear-gradient(270deg, #000, transparent 90%), linear-gradient(180deg, #000 55%, transparent);
  mask-image:
    linear-gradient(270deg, #000, transparent 90%), linear-gradient(180deg, #000 55%, transparent);
  -webkit-mask-composite: source-in;
  mask-composite: intersect;

  @media (min-width: 768px) {
    width: 30%;
  }
}

// Skip link: visible only on keyboard focus.
.layout__skip-link {
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
</style>
