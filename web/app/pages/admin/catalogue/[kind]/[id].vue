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
const { record, errorKey, saving } = editor
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
const backToList = () => navigateTo(listLocation.value)

/** Saves, then goes back to the list if the API accepted. */
async function submit() {
  if (await editor.save()) await backToList()
}

const confirmingArchive = ref(false)
/** Archives the record, then goes back to the list. */
async function archive() {
  if (await editor.setArchived(true)) {
    isLeaving = true
    await backToList()
  }
}
/** Restores the record. */
const restore = () => editor.setArchived(false)

// Leaving the record with unsaved input asks for confirmation.
const confirmingLeave = ref(false)
let pendingDestination: RouteLocationNormalized | null = null
let isLeaving = false
// A router guard (removed with the page) rather than `onBeforeRouteLeave`, which cannot see the
// page when it is mounted alone in tests.
if (import.meta.client) {
  const removeLeaveGuard = useRouter().beforeEach((to, from) => {
    // Changing section (`?section=`) stays on the same record.
    if (to.path === from.path || isLeaving || !editor.isDirty.value) return true
    pendingDestination = to
    confirmingLeave.value = true
    return false
  })
  onBeforeUnmount(removeLeaveGuard)
}
/** Leaves for the destination that was held back by the guard. */
function leave() {
  isLeaving = true
  if (pendingDestination) navigateTo(pendingDestination)
}
/** Asks the browser to confirm closing the tab while input is unsaved. */
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (editor.isDirty.value) event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
</script>

<template>
  <div class="edit">
    <AdminNav />
    <NuxtLink :to="listLocation" class="edit__back link-underlined" data-testid="admin-back">
      <Icon name="tabler:chevron-left" size="16" aria-hidden="true" />{{ t('admin.back') }}
    </NuxtLink>
    <header class="edit__head">
      <div class="edit__heading">
        <h1 class="edit__title">{{ record?.heading ?? t(`admin.heading.new.${kind}`) }}</h1>
        <span
          v-if="record"
          class="edit__badge"
          :class="{ 'edit__badge--archived': record.archived }"
          data-testid="admin-state"
        >
          {{ t(record.archived ? 'admin.archived' : 'admin.published') }}
        </span>
      </div>
      <template v-if="record">
        <UiButton
          v-if="record.archived"
          class="edit__action"
          variant="secondary"
          data-testid="admin-restore"
          @click="restore"
        >
          <Icon name="tabler:restore" size="16" aria-hidden="true" />{{ t('admin.restore') }}
        </UiButton>
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
    <AdminWorkForm
      v-if="kind === 'works'"
      v-model="editor.work.value"
      :genres="genres?.items ?? []"
      :search="search"
      :error-key="errorKey"
      :saving="saving"
      @submit="submit"
    />
    <AdminPersonForm
      v-else-if="kind === 'people'"
      v-model="editor.person.value"
      :error-key="errorKey"
      :saving="saving"
      @submit="submit"
    />
    <AdminPublisherForm
      v-else
      v-model="editor.publisher.value"
      :error-key="errorKey"
      :saving="saving"
      @submit="submit"
    />
    <AdminArchiveConfirm
      v-model="confirmingArchive"
      data-testid="archive-confirm"
      :kind="kind"
      :impact="record?.impact"
      @confirm="archive"
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

.edit__badge {
  padding: 1px 9px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--status-reading);
  font-size: 0.75rem;
  font-weight: 800;
}

.edit__badge--archived {
  background: var(--color-chip);
}

.edit__action {
  margin-left: auto;
}
</style>
