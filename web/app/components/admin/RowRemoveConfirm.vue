<script setup lang="ts">
// Confirmation du retrait d'une ligne déjà saisie d'un formulaire d'administration : textes et rouge
// portés ici, une seule fois.
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
