<script setup lang="ts">
import type { RouteLocationNormalized } from 'vue-router'
import type { RecordRef } from '~/utils/admin'

/** Catalogue record being created (`/new`) or edited. */
definePageMeta({
  middleware: 'admin',
  validate: (route) => parseAdminEditRoute(route.params) !== null,
})

const route = useRoute()
const { t } = useI18n()
const target = parseAdminEditRoute(route.params) ?? { kind: 'works' as const, id: 'new' as const }
const { kind, id } = target
const editor = useAdminEditor(kind, id)
/** Identifier of the edited record; none for a new one. */
const recordId = id === 'new' ? undefined : id
const { record, errorKey, errorScope, serverGaps, draftReferences, saving } = editor
/** Whether a refused save asks the person and publisher forms to flag their gaps. */
const showErrors = computed(() => errorScope.value !== 'none')
/** What the work form flags: the scope of the last refusal, the gaps the API reported and the drafts it named. */
const flagged = computed(() => ({
  scope: errorScope.value,
  serverGaps: serverGaps.value,
  draftReferences: draftReferences.value,
}))
const root = ref<HTMLElement | null>(null)
// A refusal message sits far from the buttons (above "Save", or the draft list above the tabs): bring it into view.
watch([errorKey, draftReferences], async ([key, drafts]) => {
  if (!key && drafts.length === 0) return
  await nextTick()
  root.value?.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center' })
})
// Arrived without going through the list (direct address): "Back" leads to this record's tab.
const { last: lastList, location: listLocation } = useAdminListLocation()
lastList.value ??= parseAdminListQuery({ kind })

useSeoMeta({
  title: () => record.value?.heading ?? t(`admin.heading.new.${kind}`),
  robots: 'noindex, nofollow',
})

await useAsyncData(`admin-edit-${kind}-${id}`, async () => {
  await editor.load()
  return true
})
// Genres do not change during editing: a single read, on the server as in the browser.
const api = useApi()
const { data: genres } = await useAsyncData('admin-genres', async () =>
  kind === 'works'
    ? await api.request<{ items: { code: string; category: string }[] }>('/genres')
    : { items: [] as { code: string; category: string }[] },
)

/** Searches records of a kind, for the pickers. */
const search = (searchKind: AdminKind, text: string): Promise<RecordRef[]> =>
  editor.client.search(searchKind, text)
/** Goes back to the list the user came from. */
async function backToList() {
  await navigateTo(listLocation.value)
}

const formatCodes = computed(() => formatCodesOf(genres.value?.items ?? []))

/** Saves (as a draft for a new record), then goes back to the list. */
const saveAndLeave = () => editor.save(formatCodes.value, false, backToList)

const confirmingRepublish = ref(false)
/** Saving a published record edits the public version: it asks first, once nothing is missing. */
function askRepublish() {
  if (editor.checkPublishable(formatCodes.value)) {
    confirmingRepublish.value = true
  }
}

/** The form's save: a published record asks first, the others save at once. */
const submit = () => (formMode.value === 'published' ? askRepublish() : saveAndLeave())

const confirmingPublish = ref(false)
/** Publishing makes the record public: it asks first, once nothing is missing. */
function askPublish() {
  if (editor.checkPublishable(formatCodes.value)) {
    confirmingPublish.value = true
  }
}

/** Saves and publishes, then goes back to the list. */
const publish = () => editor.save(formatCodes.value, true, backToList)

/** Form footer mode: a new record, or the lifecycle of the edited one. */
const formMode = computed(() => {
  if (id === 'new') return 'create' as const
  return record.value?.lifecycle ?? ('published' as const)
})
/** Translation key of the state pill. */
const stateKey = computed(() => `admin.${record.value?.lifecycle ?? 'published'}`)

const confirmingDelete = ref(false)
/** Goes back to the list without the "unsaved changes" question: the record is gone or archived. */
async function leaveToList() {
  isLeaving = true
  await backToList()
}

/** Deletes the draft or archived record for good, then goes back to the list. */
const deleteRecord = () => editor.deleteRecord(leaveToList)
/** What is deleted: a draft was never published, an archive was. */
const deleteTarget = computed(() => (record.value?.lifecycle === 'archived' ? 'archive' : 'draft'))

const confirmingArchive = ref(false)
/** Archives the record, then goes back to the list. */
const archive = () => editor.setArchived(true, leaveToList)
const confirmingRestore = ref(false)
/** Restores the record. */
const restore = () => editor.setArchived(false)

// Leaving the record with unsaved input asks for confirmation. The flag is shared so that signing
// out (account menu) warns first instead of signing out and then asking.
const hasUnsavedChanges = useUnsavedChanges()
watch(editor.isDirty, (isDirty) => (hasUnsavedChanges.value = isDirty), { immediate: true })
onBeforeUnmount(() => (hasUnsavedChanges.value = false))
const confirmingLeave = ref(false)
let pendingDestination: RouteLocationNormalized | null = null
let isLeaving = false
// A router guard (removed with the page) rather than `onBeforeRouteLeave`, which cannot see the
// page when it is mounted alone in tests.
if (import.meta.client) {
  const removeLeaveGuard = useRouter().beforeEach((to, from) => {
    // Changing section (`?section=`) stays on the same record.
    if (to.path === from.path || isLeaving || !hasUnsavedChanges.value) return true
    pendingDestination = to
    confirmingLeave.value = true
    return false
  })
  onBeforeUnmount(removeLeaveGuard)
}
/** Leaves for the destination that was held back by the guard. */
async function leave() {
  isLeaving = true
  if (pendingDestination) await navigateTo(pendingDestination)
}
/** Asks the browser to confirm closing the tab while input is unsaved. */
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value) event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
</script>

<template>
  <div ref="root" class="edit">
    <AdminNav />
    <NuxtLink :to="listLocation" class="edit__back link-underlined" data-testid="admin-back">
      <Icon name="tabler:chevron-left" size="16" aria-hidden="true" />{{ t('admin.back') }}
    </NuxtLink>
    <header class="edit__head">
      <div class="edit__heading">
        <h1 class="edit__title">{{ record?.heading ?? t(`admin.heading.new.${kind}`) }}</h1>
        <UiDraftBadge v-if="record?.lifecycle === 'draft'" data-testid="admin-state">{{
          t(stateKey)
        }}</UiDraftBadge>
        <UiStateBadge
          v-else-if="record"
          :state="record.lifecycle === 'archived' ? 'archived' : 'published'"
          data-testid="admin-state"
        >
          {{ t(stateKey) }}
        </UiStateBadge>
      </div>
      <template v-if="record">
        <UiButton
          v-if="record.lifecycle === 'draft'"
          class="edit__action"
          variant="danger"
          data-testid="admin-delete-draft"
          @click="confirmingDelete = true"
        >
          <Icon name="tabler:trash" size="16" aria-hidden="true" />{{ t('admin.deleteDraft') }}
        </UiButton>
        <div v-else-if="record.lifecycle === 'archived'" class="edit__actions">
          <UiButton
            class="edit__action"
            variant="secondary"
            data-testid="admin-restore"
            @click="confirmingRestore = true"
          >
            <Icon name="tabler:restore" size="16" aria-hidden="true" />{{ t('admin.restore') }}
          </UiButton>
          <UiButton
            class="edit__action"
            variant="danger"
            data-testid="admin-delete-archived"
            @click="confirmingDelete = true"
          >
            <Icon name="tabler:trash" size="16" aria-hidden="true" />{{ t('admin.removeArchived') }}
          </UiButton>
        </div>
        <UiButton
          v-else
          class="edit__action"
          variant="danger"
          data-testid="admin-archive"
          @click="confirmingArchive = true"
        >
          <Icon name="tabler:archive" size="16" aria-hidden="true" />{{ t('admin.archive') }}
        </UiButton>
      </template>
    </header>
    <div v-if="record?.lifecycle === 'draft'" class="edit__banner" data-testid="draft-banner">
      <Icon name="tabler:eye-off" size="20" aria-hidden="true" />
      <p class="edit__banner-text">{{ t('admin.draftBanner') }}</p>
    </div>
    <AdminWorkForm
      v-if="kind === 'works'"
      v-model="editor.work.value"
      :genres="genres?.items ?? []"
      :search="search"
      :error-key="errorKey"
      :flagged="flagged"
      :saving="saving"
      :mode="formMode"
      :record-id="recordId"
      @submit="submit"
      @publish="askPublish"
    />
    <AdminPersonForm
      v-else-if="kind === 'people'"
      v-model="editor.person.value"
      :error-key="errorKey"
      :show-errors="showErrors"
      :saving="saving"
      :mode="formMode"
      :record-id="recordId"
      @submit="submit"
      @publish="askPublish"
    />
    <AdminPublisherForm
      v-else
      v-model="editor.publisher.value"
      :error-key="errorKey"
      :show-errors="showErrors"
      :saving="saving"
      :mode="formMode"
      :record-id="recordId"
      @submit="submit"
      @publish="askPublish"
    />
    <AdminArchiveConfirm
      v-model="confirmingArchive"
      data-testid="archive-confirm"
      :kind="kind"
      :impact="record?.impact"
      @confirm="archive"
    />
    <AdminRestoreConfirm
      v-model="confirmingRestore"
      data-testid="restore-confirm"
      @confirm="restore"
    />
    <UiConfirm
      v-model="confirmingRepublish"
      data-testid="republish-confirm"
      :title="t('admin.republishConfirm.title')"
      :text="t('admin.republishConfirm.text')"
      :confirm-label="t('admin.saveRepublish')"
      :cancel-label="t('admin.republishConfirm.cancel')"
      :close-label="t('action.close')"
      @confirm="saveAndLeave"
    />
    <UiConfirm
      v-model="confirmingPublish"
      data-testid="publish-confirm"
      :title="t('admin.publishConfirm.title')"
      :text="t('admin.publishConfirm.text')"
      :confirm-label="t('admin.publish')"
      :cancel-label="t('admin.publishConfirm.cancel')"
      :close-label="t('action.close')"
      @confirm="publish"
    />
    <AdminDeleteConfirm
      v-model="confirmingDelete"
      :target="deleteTarget"
      data-testid="delete-confirm"
      @confirm="deleteRecord"
    />
    <UiConfirm
      v-model="confirmingLeave"
      danger
      data-testid="leave-confirm"
      :title="t('admin.leave.title')"
      :text="t('admin.leave.text')"
      :confirm-label="t('admin.leave.confirm')"
      :cancel-label="t('admin.leave.cancel')"
      :close-label="t('action.close')"
      @confirm="leave"
    />
  </div>
</template>

<style scoped lang="scss">
.edit {
  display: grid;
  gap: var(--space-4);
}

.edit__back {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.edit__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
}

.edit__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

// The title and its status pill stay together; the archive action goes to the other end.
.edit__heading {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
}

.edit__title {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-blue);
}

.edit__banner {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.edit__banner-text {
  margin: 0;
  font-size: 0.875rem;
}

.edit__action {
  margin-left: auto;
}
</style>
