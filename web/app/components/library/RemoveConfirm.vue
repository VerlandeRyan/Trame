<script setup lang="ts">
/** Confirmation of removing a work from the list (work page and reading edit window): texts and red styling live here, once. */
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>({ default: false })
const { t } = useI18n()
</script>

<template>
  <UiConfirm
    v-model="open"
    danger
    :title="t('library.removeTitle')"
    :text="t('library.removeText')"
    :confirm-label="t('library.remove')"
    :cancel-label="t('library.keep')"
    :close-label="t('action.close')"
    @confirm="emit('confirm')"
  />
</template>
