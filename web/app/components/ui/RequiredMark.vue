<!-- Red star after the label of a required field; hidden from screen readers (the control says `required`). -->
<template>
  <span class="required-mark" aria-hidden="true">*</span>
</template>

<style scoped lang="scss">
.required-mark {
  margin-left: 2px;
  color: var(--color-crimson);
  font-weight: 700;
}
</style>
