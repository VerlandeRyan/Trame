<script setup lang="ts">
import { optionsOf, PERSON_KINDS, type PersonDraft } from '~/utils/admin'

// Formulaire d'une personne ou d'un collectif : nom, nature, liens.
defineProps<{ errorKey?: string; saving: boolean }>()
const draft = defineModel<PersonDraft>({ required: true })
const emit = defineEmits<{ submit: [] }>()
const { t } = useI18n()
const kindOptions = optionsOf(PERSON_KINDS, (code) => t(`admin.option.person.${code}`))
</script>

<template>
  <form class="form" data-testid="person-form" @submit.prevent="emit('submit')">
    <UiField
      id="person-name"
      v-model="draft.name"
      :label="t('admin.person.name')"
      :input-attributes="{ maxlength: 200 }"
    />
    <AdminPillGroup v-model="draft.kind" :options="kindOptions" :label="t('admin.person.kind')" />
    <AdminPanel :title="t('admin.links.title')">
      <AdminLinksFields v-model="draft.links" :kinds="PERSON_LINK_KINDS" />
    </AdminPanel>
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
