<!-- Screentone rule: ink dots fading to the right. -->
<template>
  <div class="rule" aria-hidden="true" />
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Screentone rule (under "Related works"…): ink dots fading to the right.
.rule {
  position: relative;
  height: 8px;
  // `--rule-gap`: space under the rule, reduced by list blocks (Information, Authors).
  margin: 5px 0 var(--rule-gap, 10px);

  &::before {
    @include screentone(var(--color-ink), 6px, 90deg, 85%);
  }
}
</style>
