<script setup lang="ts">
import {
  languageCode,
  optionsOf,
  SYNOPSIS_SOURCES,
  TITLE_KINDS,
  type WorkDraft,
} from '~/utils/admin'

// Titres alternatifs (par langue) et synopsis (un par langue, avec sa source), chacun dans son panneau.
const draft = defineModel<WorkDraft>({ required: true })
const { t } = useI18n()
const uid = useId()
const titleKindOptions = optionsOf(TITLE_KINDS, (code) => t(`admin.option.title.${code}`))
const sourceOptions = optionsOf(SYNOPSIS_SOURCES, (code) => t(`admin.option.synopsis.${code}`))
</script>

<template>
  <div class="texts">
    <AdminPanel :title="t('admin.work.titles')" :hint="t('admin.work.titlesHint')">
      <AdminRowList
        :items="draft.titles"
        :add-label="t('admin.work.addTitle')"
        :remove-label="t('admin.work.removeTitle')"
        :row-label="t('admin.work.titleRow')"
        columns="9rem 16rem minmax(0, 1fr)"
        @add="draft.titles.push({ language: 'en', kind: 'international', title: '' })"
        @remove="draft.titles.splice($event, 1)"
      >
        <template #default="{ item, index }">
          <UiField
            :id="`${uid}-title-language-${index}`"
            v-model="item.language"
            :label="t('admin.work.language')"
            :input-attributes="{ maxlength: 3, autocomplete: 'off', sanitize: languageCode }"
          />
          <AdminSelectField
            v-model="item.kind"
            :options="titleKindOptions"
            :label="t('admin.work.titleKind')"
          />
          <UiField
            :id="`${uid}-title-${index}`"
            v-model="item.title"
            :label="t('admin.work.alternativeTitle')"
            :input-attributes="{ maxlength: 200 }"
          />
        </template>
      </AdminRowList>
    </AdminPanel>

    <AdminPanel :title="t('admin.work.synopses')" :hint="t('admin.work.synopsesHint')">
      <AdminRowList
        :items="draft.synopses"
        :add-label="t('admin.work.addSynopsis')"
        :remove-label="t('admin.work.removeSynopsis')"
        :row-label="t('admin.work.synopsisRow')"
        columns="9rem 16rem minmax(0, 1fr)"
        @add="draft.synopses.push({ language: 'fr', source: 'official', text: '' })"
        @remove="draft.synopses.splice($event, 1)"
      >
        <template #default="{ item, index }">
          <UiField
            :id="`${uid}-synopsis-language-${index}`"
            v-model="item.language"
            :label="t('admin.work.language')"
            :input-attributes="{ maxlength: 3, autocomplete: 'off', sanitize: languageCode }"
          />
          <AdminSelectField
            v-model="item.source"
            :options="sourceOptions"
            :label="t('admin.work.synopsisSource')"
          />
          <div class="texts__text">
            <label :for="`${uid}-synopsis-${index}`" class="texts__label">
              {{ t('admin.work.synopsis') }}
            </label>
            <textarea
              :id="`${uid}-synopsis-${index}`"
              v-model="item.text"
              class="texts__area"
              rows="6"
              maxlength="5000"
            />
          </div>
        </template>
      </AdminRowList>
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
  color: var(--color-ink-soft);
  font-size: 0.875rem;
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
  // 16 px minimum : évite le zoom automatique de Safari iOS à la prise de focus.
  font-size: 1rem;
  resize: vertical;
}
</style>
