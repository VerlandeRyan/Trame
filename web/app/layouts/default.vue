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
.layout__main {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
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
