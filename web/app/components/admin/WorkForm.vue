<script setup lang="ts">
import type {
  AdminKind,
  DraftReference,
  ErrorScope,
  FormMode,
  PublicationGap,
  RecordRef,
  WorkFormValues,
  WorkSection,
} from '~/utils/admin'

/**
 * Work form in sections: all stay in the form, only one is visible, so that a save takes
 * everything. A covers section will come with image upload.
 */
const props = defineProps<{
  genres: { code: string; category: string }[]
  search: (kind: AdminKind, text: string) => Promise<RecordRef[]>
  errorKey?: string
  /**
   * What to flag after a refused save: `scope` is every gap (publication) or the title alone
   * (draft); `serverGaps` are those the API reported (its refusal, or the saved record's own),
   * flagged with the local ones.
   */
  flagged?: {
    scope: ErrorScope
    serverGaps: readonly PublicationGap[]
    /** Draft records the API named as blocking the publication. */
    draftReferences?: readonly DraftReference[]
  }
  saving: boolean
  mode?: FormMode
}>()
const form = defineModel<WorkFormValues>({ required: true })
const emit = defineEmits<{ submit: []; publish: [] }>()
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
const formatCodes = computed(() => formatCodesOf(props.genres))
const serverGaps = computed(() => props.flagged?.serverGaps ?? [])
const draftReferences = computed(() => props.flagged?.draftReferences ?? [])
const isTitleOnly = computed(() => props.flagged?.scope === 'title')
/** Whether the fields other than the title flag their gaps. */
const showsGaps = computed(() => props.flagged?.scope === 'all')
/** Sections to mark with an alert (gaps are only flagged after a refused save). */
const flaggedSections = computed(() => {
  if (isTitleOnly.value) return isBlank(form.value.title) ? ['info' as const] : []
  if (!showsGaps.value) return []
  const sections = incompleteSections(form.value, formatCodes.value, serverGaps.value)
  const draftSections = new Set<WorkSection>(
    draftReferences.value.map(({ kind }) => (kind === 'works' ? 'relations' : 'people')),
  )
  return WORK_SECTIONS.filter((id) => sections.includes(id) || draftSections.has(id))
})
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
  <form class="form" data-testid="work-form" novalidate @submit.prevent="emit('submit')">
    <UiRequiredLegend />
    <AdminDraftReferences :references="draftReferences" />
    <UiTabs v-model="section" underline :tabs="tabs" :label="t('admin.work.sections')" />
    <section v-show="section === 'info'" role="tabpanel" class="form__section">
      <AdminWorkInfoFields
        v-model="form"
        :genres="genres"
        :show-errors="isTitleOnly || showsGaps"
        :title-only="isTitleOnly"
        :server-gaps="serverGaps"
      />
    </section>
    <section v-show="section === 'texts'" role="tabpanel" class="form__section">
      <AdminWorkTextFields v-model="form" :show-errors="showsGaps" :server-gaps="serverGaps" />
    </section>
    <section v-show="section === 'relations'" role="tabpanel" class="form__section">
      <AdminWorkRelatedFields
        v-model="form"
        part="relations"
        :search="search"
        :show-errors="showsGaps"
        :draft-references="draftReferences"
      />
    </section>
    <section v-show="section === 'links'" role="tabpanel" class="form__section">
      <AdminPanel :title="t('admin.links.title')">
        <AdminLinksFields v-model="form.links" :kinds="WORK_LINK_KINDS" :show-errors="showsGaps" />
      </AdminPanel>
    </section>
    <section v-show="section === 'people'" role="tabpanel" class="form__section">
      <AdminWorkRelatedFields
        v-model="form"
        part="people"
        :search="search"
        :show-errors="showsGaps"
        :server-gaps="serverGaps"
        :draft-references="draftReferences"
      />
    </section>
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
  gap: var(--space-6);
}
</style>
