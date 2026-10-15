<script setup lang="ts">
const { t } = useI18n()

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

// Pleine largeur, comme les maquettes : mêmes marges latérales que l'en-tête (22 px au bureau).
.layout__main {
  flex: 1;
  padding: var(--space-4) var(--space-3) var(--space-6);

  @media (min-width: 768px) {
    padding: 26px 22px 30px;
  }

  // À l'intérieur : à l'extérieur, les bords de la fenêtre le rogneraient.
  &:focus-visible {
    outline-offset: -3px;
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
