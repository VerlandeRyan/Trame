<script setup lang="ts">
import {
  isBlank,
  isSynopsisRowFilled,
  isTitleRowFilled,
  optionsOf,
  publicationGapsOf,
  SYNOPSIS_SOURCES,
  TITLE_KINDS,
  type PublicationGap,
  type WorkFormValues,
} from '~/utils/admin'

/**
 * Alternative titles (per language) and synopses (one per language, with its source), each in its
 * own panel. `showErrors` flags the required fields left empty (after a refused save).
 */
const props = defineProps<{
  showErrors?: boolean
  /** Gaps the API reported, flagged like the local ones. */
  serverGaps?: readonly PublicationGap[]
}>()
/** Whether a required text is flagged: empty, after a refused save. */
const isFlagged = (text: string) => props.showErrors === true && isBlank(text)
const form = defineModel<WorkFormValues>({ required: true })
const { t } = useI18n()
/** Whether no synopsis is written in the original language: flagged after a refused publication. */
const isNoOriginalSynopsis = computed(
  () =>
    props.showErrors === true &&
    publicationGapsOf(form.value, [], props.serverGaps).includes('synopses'),
)
const uid = useId()
const languageOptionsFor = useLanguageOptions()
const titleKindOptions = optionsOf(TITLE_KINDS, (code) => t(`admin.option.title.${code}`))
const sourceOptions = optionsOf(SYNOPSIS_SOURCES, (code) => t(`admin.option.synopsis.${code}`))
</script>

<template>
  <div class="texts">
    <AdminPanel :title="t('admin.work.titles')" :hint="t('admin.work.titlesHint')">
      <AdminRowList
        :items="form.titles"
        :add-label="t('admin.work.addTitle')"
        :remove-label="t('admin.work.removeTitle')"
        :row-label="t('admin.work.titleRow')"
        :is-filled="isTitleRowFilled"
        columns="9rem 16rem minmax(0, 1fr)"
        @add="form.titles.push({ language: 'en', kind: 'international', title: '' })"
        @remove="form.titles.splice($event, 1)"
      >
        <template #default="{ item, index }">
          <AdminSelectField
            v-model="item.language"
            :label="t('admin.work.language')"
            :options="languageOptionsFor(item.language)"
            required
          />
          <AdminSelectField
            v-model="item.kind"
            :options="titleKindOptions"
            :label="t('admin.work.titleKind')"
            required
          />
          <UiField
            :id="`${uid}-title-${index}`"
            v-model="item.title"
            :label="t('admin.work.alternativeTitle')"
            :error="isFlagged(item.title) ? t('admin.error.required') : undefined"
            :input-attributes="{ maxlength: 200, required: true }"
          />
        </template>
      </AdminRowList>
    </AdminPanel>

    <AdminPanel :title="t('admin.work.synopses')" :hint="t('admin.work.synopsesHint')">
      <AdminRowList
        :items="form.synopses"
        :add-label="t('admin.work.addSynopsis')"
        :remove-label="t('admin.work.removeSynopsis')"
        :row-label="t('admin.work.synopsisRow')"
        :is-filled="isSynopsisRowFilled"
        columns="9rem 16rem minmax(0, 1fr)"
        @add="form.synopses.push({ language: 'fr', source: 'official', text: '' })"
        @remove="form.synopses.splice($event, 1)"
      >
        <template #default="{ item, index }">
          <AdminSelectField
            v-model="item.language"
            :label="t('admin.work.language')"
            :options="languageOptionsFor(item.language)"
            required
          />
          <AdminSelectField
            v-model="item.source"
            :options="sourceOptions"
            :label="t('admin.work.synopsisSource')"
            required
          />
          <div class="texts__text">
            <label :for="`${uid}-synopsis-${index}`" class="texts__label"
              >{{ t('admin.work.synopsis') }}<UiRequiredMark
            /></label>
            <textarea
              :id="`${uid}-synopsis-${index}`"
              v-model="item.text"
              class="texts__area"
              :class="{ 'texts__area--invalid': isFlagged(item.text) }"
              rows="6"
              maxlength="5000"
              aria-required="true"
              :aria-invalid="isFlagged(item.text) ? 'true' : undefined"
              :aria-describedby="
                isFlagged(item.text) ? `${uid}-synopsis-${index}-error` : undefined
              "
            />
            <UiFormError v-if="isFlagged(item.text)" :id="`${uid}-synopsis-${index}-error`">
              {{ t('admin.error.required') }}
            </UiFormError>
          </div>
        </template>
      </AdminRowList>
      <UiFormError v-if="isNoOriginalSynopsis">{{ t('admin.error.synopsisRequired') }}</UiFormError>
    </AdminPanel>
  </div>
</template>

<style scoped lang="scss">
.texts {
  display: grid;
  gap: var(--space-6);
}

.texts__text {
  display: grid;
  gap: var(--space-1);

  @media (min-width: 768px) {
    grid-column: 1 / -1;
  }
}

.texts__label {
  font-weight: 700;
}

.texts__area {
  width: 100%;
  padding: var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  font: inherit;
  // 16 px minimum: avoids Safari iOS's automatic zoom on focus.
  font-size: 1rem;
  resize: vertical;
}

.texts__area--invalid {
  border-color: var(--color-crimson);
}
</style>
