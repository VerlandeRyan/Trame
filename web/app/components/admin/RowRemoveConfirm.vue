<script setup lang="ts">
/** Confirmation of removing an already filled row of an administration form: texts and red styling live here, once. */
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>({ default: false })
const { t } = useI18n()
</script>

<template>
  <UiConfirm
    v-model="open"
    danger
    :title="t('admin.rowRemove.title')"
    :text="t('admin.rowRemove.text')"
    :confirm-label="t('admin.rowRemove.confirm')"
    :cancel-label="t('admin.rowRemove.cancel')"
    :close-label="t('action.close')"
    @confirm="emit('confirm')"
  />
</template>
