<script setup lang="ts">
/** Restoration confirmation of an archived record, the same from the record and from the list. */
const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()
</script>

<template>
  <UiConfirm
    v-model="open"
    :title="t('admin.restoreConfirm.title')"
    :text="t('admin.restoreConfirm.text')"
    :confirm-label="t('admin.restore')"
    :cancel-label="t('admin.restoreConfirm.cancel')"
    :close-label="t('action.close')"
    @confirm="emit('confirm')"
  />
</template>
