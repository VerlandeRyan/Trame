<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

// Attributs lang/dir selon la langue d'interface (hreflang/SEO : à ajouter avec l'URL publique).
const localeHead = useLocaleHead({ dir: true, seo: false })
useHead(() => ({
  htmlAttrs: {
    lang: localeHead.value.htmlAttrs?.lang,
    dir: localeHead.value.htmlAttrs?.dir,
  },
}))
</script>

<template>
  <div class="layout">
    <a class="layout__skip-link" href="#contenu">{{ t('nav.skipToContent') }}</a>
    <LayoutHeader />
    <!-- Décor : trame de points roses au bord droit, sous l'en-tête, derrière le contenu. -->
    <div v-if="route.meta.trame !== 'hero'" class="layout__trame" aria-hidden="true" />
    <main id="contenu" class="layout__main" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
// Le contenu s'étire : le contour de focus de `<main>` entoure toute la page.
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

// Mêmes marges latérales que l'en-tête. Ce sont des variables : l'accueil les annule pour ses bandes.
.layout__main {
  --main-pad-top: var(--space-4);
  --main-pad-x: var(--space-3);
  --main-pad-bottom: var(--space-6);

  // Au-dessus de la trame décorative (`z-index` 0).
  position: relative;
  z-index: 1;
  flex: 1;
  padding: var(--main-pad-top) var(--main-pad-x) var(--main-pad-bottom);

  @media (min-width: 768px) {
    --main-pad-top: 26px;
    --main-pad-x: 22px;
    --main-pad-bottom: 30px;
  }

  // À l'intérieur : à l'extérieur, les bords de la fenêtre le rogneraient.
  &:focus-visible {
    outline-offset: -3px;
  }
}

// Trame rose du bord droit, fixe pendant le défilement, qui s'estompe vers la gauche et le bas.
// Décor : ni clic ni lecteur d'écran.
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

// Lien d'évitement : visible seulement au focus clavier.
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
