<script setup lang="ts">
import type { AdminKind, RecordRef, WorkDraft } from '~/utils/admin'

// Fiche œuvre en sections (maquette 22, état 3) : toutes restent dans le formulaire, une seule est
// visible, pour qu'un enregistrement prenne tout. La section « Couvertures » viendra avec l'envoi
// d'images.
const props = defineProps<{
  genres: { code: string; category: string }[]
  search: (kind: AdminKind, text: string) => Promise<RecordRef[]>
  errorKey?: string
  saving: boolean
}>()
const draft = defineModel<WorkDraft>({ required: true })
const emit = defineEmits<{ submit: [] }>()
const { t } = useI18n()

// La section visible est dans l'adresse (`?section=links`) : un rechargement la retrouve.
const route = useRoute()
const router = useRouter()
const section = computed({
  get: () => parseWorkSection(route.query.section),
  set: (id) =>
    router.replace({
      query: { ...route.query, section: id === WORK_SECTIONS[0] ? undefined : id },
    }),
})
// Les lignes incomplètes ne sont signalées qu'après un enregistrement refusé pour cette raison.
const isIncompleteRefused = computed(() => props.errorKey === INCOMPLETE_ROWS_ERROR_KEY)
const flaggedSections = computed(() =>
  isIncompleteRefused.value ? incompleteSections(draft.value) : [],
)
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
