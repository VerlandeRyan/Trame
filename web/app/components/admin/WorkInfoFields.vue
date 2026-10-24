<script setup lang="ts">
import {
  digitsOnly,
  languageCode,
  optionsOf,
  WORK_STATUSES,
  WORK_TYPES,
  type WorkDraft,
} from '~/utils/admin'

// Informations d'une œuvre sur deux colonnes : identité et publication à gauche, dates, formats et
// genres à droite. Chaque champ n'accepte que ce que l'API accepte (chiffres, lettres, date).
const props = defineProps<{ genres: { code: string; category: string }[] }>()
const draft = defineModel<WorkDraft>({ required: true })
const { t } = useI18n()
const genreLabel = useGenreLabel()
const typeOptions = optionsOf(WORK_TYPES, (code) => t(`admin.option.workType.${code}`))
const statusOptions = optionsOf(WORK_STATUSES, (code) => t(`admin.option.workStatus.${code}`))
// RG-18 : les totaux restent vides tant que l'œuvre est en cours.
const isOngoing = computed(() => draft.value.status === 'ongoing')
const optionsIn = (category: string) =>
  props.genres
    .filter((genre) => genre.category === category)
    .map(({ code }) => ({ value: code, label: genreLabel(code) }))
const formatOptions = computed(() => optionsIn('format'))
const themeOptions = computed(() => optionsIn('theme'))

/** Coche ou décoche des codes d'une catégorie sans toucher à ceux de l'autre. */
function setCategory(options: { value: string }[], chosen: string[]) {
  const codes = new Set(options.map((option) => option.value))
  draft.value.genres = [...draft.value.genres.filter((code) => !codes.has(code)), ...chosen]
}
const chosenIn = (options: { value: string }[]) =>
  draft.value.genres.filter((code) => options.some((option) => option.value === code))
</script>

<template>
  <div class="info">
    <AdminPanel :title="t('admin.work.identity')">
      <UiField
        id="work-title"
        v-model="draft.title"
        :label="t('admin.work.title')"
        :input-attributes="{ maxlength: 200 }"
      />
      <UiField
        id="work-language"
        v-model="draft.originalLanguage"
        :label="t('admin.work.originalLanguage')"
        :hint="t('admin.work.originalLanguageHint')"
        :input-attributes="{ maxlength: 3, autocomplete: 'off', sanitize: languageCode }"
      />
      <AdminPillGroup v-model="draft.type" :label="t('admin.work.type')" :options="typeOptions" />
      <AdminPillGroup
        v-model="draft.status"
        :label="t('admin.work.status')"
        :options="statusOptions"
      />
      <p v-if="isOngoing" class="info__note">{{ t('admin.work.totalsOngoing') }}</p>
      <div v-else class="info__pair">
        <UiField
          id="work-chapters"
          v-model="draft.chapters"
          :label="t('admin.work.chapters')"
          :input-attributes="{ inputmode: 'numeric', maxlength: 5, sanitize: digitsOnly }"
        />
        <UiField
          id="work-volumes"
          v-model="draft.volumes"
          :label="t('admin.work.volumes')"
          :input-attributes="{ inputmode: 'numeric', maxlength: 5, sanitize: digitsOnly }"
        />
      </div>
    </AdminPanel>
    <AdminPanel :title="t('admin.work.release')">
      <div class="info__pair">
        <UiField
          id="work-started"
          v-model="draft.startedOn"
          :label="t('admin.work.startedOn')"
          :input-attributes="{ type: 'date' }"
        />
        <UiField
          id="work-ended"
          v-model="draft.endedOn"
          :label="t('admin.work.endedOn')"
          :input-attributes="{ type: 'date', min: draft.startedOn || undefined }"
        />
      </div>
      <AdminPillGroup
        v-if="formatOptions.length > 0"
        multiple
        :label="t('admin.work.formats')"
        :options="formatOptions"
        :model-value="chosenIn(formatOptions)"
        @update:model-value="setCategory(formatOptions, $event as string[])"
      />
      <AdminTagPicker
        v-if="themeOptions.length > 0"
        :label="t('admin.work.genres')"
        :placeholder="t('admin.work.genresPlaceholder')"
        :empty-label="t('admin.work.genresNone')"
        :remove-label="(name) => t('admin.work.genreRemove', { name })"
        :options="themeOptions"
        :model-value="chosenIn(themeOptions)"
        @update:model-value="setCategory(themeOptions, $event)"
      />
    </AdminPanel>
  </div>
</template>

<style scoped lang="scss">
.info {
  display: grid;
  gap: var(--space-6);

  @media (min-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.info__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.info__note {
  margin: 0;
  color: var(--color-ink-soft);
}
</style>
