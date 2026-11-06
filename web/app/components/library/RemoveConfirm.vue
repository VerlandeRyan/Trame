<script setup lang="ts">
// Confirmation du retrait d'une œuvre de la liste (fiche œuvre et « Modifier ma lecture ») : textes
// et rouge portés ici, une seule fois.
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
