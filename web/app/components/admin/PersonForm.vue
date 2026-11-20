<script setup lang="ts">
import {
  isBlank,
  optionsOf,
  PERSON_KINDS,
  type FormMode,
  type PersonFormValues,
} from '~/utils/admin'

/** Form of a person or a collective: name, kind, links. */
const props = defineProps<{
  errorKey?: string
  /** Flags the required fields left empty, after a save refused for that reason. */
  showErrors?: boolean
  saving: boolean
  mode?: FormMode
}>()
const form = defineModel<PersonFormValues>({ required: true })
const emit = defineEmits<{ submit: []; publish: [] }>()
const { t } = useI18n()
const kindOptions = optionsOf(PERSON_KINDS, (code) => t(`admin.option.person.${code}`))
const isNameMissing = computed(() => props.showErrors === true && isBlank(form.value.name))
</script>

<template>
  <form class="form" data-testid="person-form" novalidate @submit.prevent="emit('submit')">
    <UiRequiredLegend />
    <UiField
      id="person-name"
      v-model="form.name"
      :label="t('admin.person.name')"
      :error="isNameMissing ? t('admin.error.required') : undefined"
      :input-attributes="{ maxlength: 200, required: true }"
    />
    <AdminPillGroup
      v-model="form.kind"
      :options="kindOptions"
      :label="t('admin.person.kind')"
      required
    />
    <AdminPanel :title="t('admin.links.title')">
      <AdminLinksFields v-model="form.links" :kinds="PERSON_LINK_KINDS" :show-errors="showErrors" />
    </AdminPanel>
    <AdminFormActions
      :error-key="errorKey"
      :saving="saving"
      :mode="mode"
      @publish="emit('publish')"
    />
  </form>
</template>

<style scoped lang="scss">
.form {
  display: grid;
  gap: var(--space-4);
  max-width: 40rem;
}
</style>
