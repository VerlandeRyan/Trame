<script setup lang="ts">
/**
 * Confirmation of the permanent deletion of a record, the same from the record and from the list.
 * The wording says whether a draft (never published) or an archive is deleted.
 */
const props = defineProps<{ target: 'draft' | 'archive' }>()
const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()

/** Translation key group of the wording. */
const wording = computed(() => (props.target === 'draft' ? 'deleteDraft' : 'removeArchived'))
</script>

<template>
  <UiConfirm
    v-model="open"
    danger
    :title="t(`admin.${wording}Confirm.title`)"
    :text="t(`admin.${wording}Confirm.text`)"
    :confirm-label="t(`admin.${wording}`)"
    :cancel-label="t(`admin.${wording}Confirm.cancel`)"
    :close-label="t('action.close')"
    @confirm="emit('confirm')"
  />
</template>
