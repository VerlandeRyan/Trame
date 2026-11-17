<script setup lang="ts">
import { isBlank, optionsOf, PERSON_KINDS, type PersonDraft } from '~/utils/admin'

/** Form of a person or a collective: name, kind, links. */
const props = defineProps<{
  errorKey?: string
  /** Flags the required fields left empty, after a save refused for that reason. */
  showErrors?: boolean
  saving: boolean
}>()
const draft = defineModel<PersonDraft>({ required: true })
const emit = defineEmits<{ submit: [] }>()
const { t } = useI18n()
const kindOptions = optionsOf(PERSON_KINDS, (code) => t(`admin.option.person.${code}`))
const isNameMissing = computed(() => props.showErrors === true && isBlank(draft.value.name))
</script>

<template>
  <form class="form" data-testid="person-form" novalidate @submit.prevent="emit('submit')">
    <UiRequiredLegend />
    <UiField
      id="person-name"
      v-model="draft.name"
      :label="t('admin.person.name')"
      :error="isNameMissing ? t('admin.error.required') : undefined"
      :input-attributes="{ maxlength: 200, required: true }"
    />
    <AdminPillGroup
      v-model="draft.kind"
      :options="kindOptions"
      :label="t('admin.person.kind')"
      required
    />
    <AdminPanel :title="t('admin.links.title')">
      <AdminLinksFields
        v-model="draft.links"
        :kinds="PERSON_LINK_KINDS"
        :show-errors="showErrors"
      />
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
