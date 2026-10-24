<script setup lang="ts">
import { optionsOf, PUBLISHER_KINDS, type PublisherDraft } from '~/utils/admin'

// Formulaire d'un éditeur ou d'une plateforme : nom, nature, site.
defineProps<{ errorKey?: string; saving: boolean }>()
const draft = defineModel<PublisherDraft>({ required: true })
const emit = defineEmits<{ submit: [] }>()
const { t } = useI18n()
const kindOptions = optionsOf(PUBLISHER_KINDS, (code) => t(`admin.option.publisher.${code}`))
</script>

<template>
  <form class="form" data-testid="publisher-form" @submit.prevent="emit('submit')">
    <UiField
      id="publisher-name"
      v-model="draft.name"
      :label="t('admin.publisher.name')"
      :input-attributes="{ maxlength: 200 }"
    />
    <AdminPillGroup
      v-model="draft.kind"
      :options="kindOptions"
      :label="t('admin.publisher.kind')"
    />
    <UiField
      id="publisher-url"
      v-model="draft.url"
      :label="t('admin.publisher.url')"
      :input-attributes="{ type: 'url', autocomplete: 'off' }"
    />
    <AdminFormActions :error-key="errorKey" :saving="saving" />
  </form>
</template>

<style scoped lang="scss">
.form {
  display: grid;
  gap: var(--space-4);
  max-width: 40rem;
}
</style>
