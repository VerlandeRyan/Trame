<script setup lang="ts">
import type { AdminKind, RecordRef, WorkDraft } from '~/utils/admin'

/**
 * Work form in sections: all stay in the form, only one is visible, so that a save takes
 * everything. A covers section will come with image upload.
 */
const props = defineProps<{
  genres: { code: string; category: string }[]
  search: (kind: AdminKind, text: string) => Promise<RecordRef[]>
  errorKey?: string
  saving: boolean
}>()
const draft = defineModel<WorkDraft>({ required: true })
const emit = defineEmits<{ submit: [] }>()
const { t } = useI18n()

// The visible section is in the address (`?section=links`): a reload finds it again.
const route = useRoute()
const router = useRouter()
const section = computed({
  get: () => parseWorkSection(route.query.section),
  set: (id) =>
    router.replace({
      query: { ...route.query, section: id === WORK_SECTIONS[0] ? undefined : id },
    }),
})
// Incomplete rows are only flagged after a save refused for that reason.
const isIncompleteRefused = computed(() => props.errorKey === INCOMPLETE_ROWS_ERROR_KEY)
/** Sections to mark with an alert. */
const flaggedSections = computed(() =>
  isIncompleteRefused.value ? incompleteSections(draft.value) : [],
)
/** One tab per section, with an alert on incomplete ones. */
const tabs = computed(() =>
  WORK_SECTIONS.map((id) => ({
    id,
    label: t(`admin.work.section.${id}`),
    alert: flaggedSections.value.includes(id) ? t('admin.sectionIncomplete') : undefined,
  })),
)
</script>

<template>
  <form class="form" data-testid="work-form" @submit.prevent="emit('submit')">
    <UiTabs v-model="section" underline :tabs="tabs" :label="t('admin.work.sections')" />
    <section v-show="section === 'info'" role="tabpanel" class="form__section">
      <AdminWorkInfoFields v-model="draft" :genres="genres" />
    </section>
    <section v-show="section === 'texts'" role="tabpanel" class="form__section">
      <AdminWorkTextFields v-model="draft" />
    </section>
    <section v-show="section === 'relations'" role="tabpanel" class="form__section">
      <AdminWorkRelatedFields
        v-model="draft"
        part="relations"
        :search="search"
        :show-errors="isIncompleteRefused"
      />
    </section>
    <section v-show="section === 'links'" role="tabpanel" class="form__section">
      <AdminPanel :title="t('admin.links.title')">
        <AdminLinksFields v-model="draft.links" :kinds="WORK_LINK_KINDS" />
      </AdminPanel>
    </section>
    <section v-show="section === 'people'" role="tabpanel" class="form__section">
      <AdminWorkRelatedFields
        v-model="draft"
        part="people"
        :search="search"
        :show-errors="isIncompleteRefused"
      />
    </section>
    <AdminFormActions :error-key="errorKey" :saving="saving" />
  </form>
</template>

<style scoped lang="scss">
.form {
  display: grid;
  gap: var(--space-6);
}
</style>
