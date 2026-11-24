<script setup lang="ts">
import {
  isBlank,
  optionsOf,
  PUBLISHER_KINDS,
  URL_MAX_LENGTH,
  urlErrorKey,
  type FormMode,
  type PublisherFormValues,
} from '~/utils/admin'

/** Form of a publisher or a platform: name, kind, website. */
const props = defineProps<{
  errorKey?: string
  /** Flags the required fields and a malformed website, after a save refused for that reason. */
  showErrors?: boolean
  saving: boolean
  mode?: FormMode
  /** Record being edited, left out of the namesake notice. */
  recordId?: number
}>()
const form = defineModel<PublisherFormValues>({ required: true })
const emit = defineEmits<{ submit: []; publish: [] }>()
const { t } = useI18n()
const kindOptions = optionsOf(PUBLISHER_KINDS, (code) => t(`admin.option.publisher.${code}`))
const isNameMissing = computed(() => props.showErrors === true && isBlank(form.value.name))
const urlError = computed(() => {
  const key = props.showErrors ? urlErrorKey(form.value.url, false) : undefined
  return key ? t(key) : undefined
})
</script>

<template>
  <form class="form" data-testid="publisher-form" novalidate @submit.prevent="emit('submit')">
    <UiRequiredLegend />
    <AdminNamesakeNotice kind="publishers" :name="form.name" :record-id="recordId">
      <UiField
        id="publisher-name"
        v-model="form.name"
        :label="t('admin.publisher.name')"
        :error="isNameMissing ? t('admin.error.required') : undefined"
        :input-attributes="{ maxlength: 200, required: true }"
      />
    </AdminNamesakeNotice>
    <AdminPillGroup
      v-model="form.kind"
      :options="kindOptions"
      :label="t('admin.publisher.kind')"
      required
    />
    <UiField
      id="publisher-url"
      v-model="form.url"
      :label="t('admin.publisher.url')"
      :error="urlError"
      :input-attributes="{ type: 'url', autocomplete: 'off', maxlength: URL_MAX_LENGTH }"
    />
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
