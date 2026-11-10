<!-- Error message announced as an alert, with an icon. -->
<template>
  <p class="form-error" role="alert">
    <Icon name="tabler:alert-circle" size="18" aria-hidden="true" />
    <span><slot /></span>
  </p>
</template>

<style scoped lang="scss">
.form-error {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  margin: 0;
  color: var(--color-crimson);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
