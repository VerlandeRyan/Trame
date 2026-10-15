<template>
  <div class="rule" aria-hidden="true" />
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Frise en trame (sous « Œuvres liées »…) : points d'encre en fondu vers la droite.
.rule {
  position: relative;
  height: 8px;
  // `--rule-gap` : espace sous la frise, réduit par les blocs de liste (Informations, Auteurs).
  margin: 5px 0 var(--rule-gap, 10px);

  &::before {
    @include screentone(var(--color-ink), 6px, 90deg, 85%);
  }
}
</style>
