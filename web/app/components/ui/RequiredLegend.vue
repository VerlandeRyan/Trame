<!-- Line at the top of a form explaining the red star: « * required field ». -->
<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <p class="required-legend">
    <span class="required-legend__star">*</span> {{ t('form.requiredLegend') }}
  </p>
</template>

<style scoped lang="scss">
.required-legend {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.required-legend__star {
  color: var(--color-crimson);
  font-weight: 700;
}
</style>
