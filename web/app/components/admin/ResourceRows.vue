<script setup lang="ts">
import {
  adminEditPath,
  itemLabel,
  type AdminKind,
  type AdminListItem,
  type ArchiveImpact,
} from '~/utils/admin'
import { updateAge } from '~/utils/profile'

/**
 * Catalogue table: one row per record, "Edit" or, for an archive, "Restore". Archiving is done
 * from the record, or from the "⋮" sheet (`admin/RowMenu`) on mobile. `loadImpact` (works) reads
 * what archiving leaves in place, for the confirmation.
 */
const props = defineProps<{
  kind: AdminKind
  items: AdminListItem[]
  loadImpact?: (item: AdminListItem) => Promise<ArchiveImpact>
}>()
const emit = defineEmits<{ restore: [item: AdminListItem]; archive: [item: AdminListItem] }>()
const { t } = useI18n()
const localePath = useLocalePath()

const isWorks = computed(() => props.kind === 'works')
/** Column headings of the table for the kind. */
const columns = computed(() =>
  isWorks.value
    ? ['work', 'typeFormat', 'author', 'status', 'completeness']
    : ['name', 'kindLabel', 'works'],
)

const ACTION_COLUMN = '7.5rem'
/** CSS grid columns of a row. */
const gridColumns = computed(() =>
  isWorks.value
    ? `minmax(0, 3fr) minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.4fr) ${ACTION_COLUMN}`
    : `minmax(0, 3fr) minmax(0, 1fr) minmax(0, 1fr) ${ACTION_COLUMN}`,
)

/** Lowercase relative age of a date ("3 days"), empty without a date. */
const ageLabel = (iso: string | null | undefined) => {
  if (!iso) return ''
  const age = updateAge(iso)
  const label =
    'count' in age
      ? t(`profile.age.${age.unit}`, { count: age.count })
      : t(`profile.age.${age.unit}`)
  return label.toLowerCase()
}

/** Line under the title: last update, or who archived it and when. */
function subtitle(item: AdminListItem): string {
  if (!item.archived)
    return item.updatedAt ? t('admin.row.updated', { age: ageLabel(item.updatedAt) }) : ''
  return t('admin.row.archivedBy', {
    age: ageLabel(item.archivedAt),
    handle: item.archivedBy ?? '?',
  })
}

const genreLabel = useGenreLabel()
/** Work type followed by its formats. */
function typeAndFormat(item: AdminListItem): string {
  const type = item.type ? t(`admin.option.workType.${item.type}`) : ''
  return [type, ...(item.formats ?? []).map(genreLabel)].filter(Boolean).join(' · ')
}

/** Translated kind of a person or publisher. */
function kindLabel(item: AdminListItem): string {
  const group = props.kind === 'people' ? 'person' : 'publisher'
  return item.kind ? t(`admin.option.${group}.${item.kind}`) : ''
}

/** Mobile: a single information line under the title. */
function summary(item: AdminListItem): string {
  const parts = isWorks.value
    ? [typeAndFormat(item), item.status ? t(`admin.option.workStatus.${item.status}`) : '']
    : [kindLabel(item), t('admin.row.worksCount', { count: item.activeWorkCount ?? 0 })]
  return parts.filter(Boolean).join(' · ')
}

const menuItem = ref<AdminListItem | null>(null)
const isMenuOpen = ref(false)
/** Opens the action sheet of a row. */
function openMenu(item: AdminListItem) {
  menuItem.value = item
  isMenuOpen.value = true
}

// Archiving asks the same confirmation as from the record, summary included (loaded on opening;
// without it, the confirmation stays usable).
const isArchiveConfirmOpen = ref(false)
const impact = ref<ArchiveImpact | null>(null)
/** Opens the archive confirmation and loads what archiving would leave in place. */
async function askArchive(item: AdminListItem) {
  isArchiveConfirmOpen.value = true
  impact.value = null
  if (!props.loadImpact) return
  try {
    const loaded = await props.loadImpact(item)
    if (menuItem.value?.id === item.id) impact.value = loaded
  } catch {
    impact.value = null
  }
}
/** Reports the confirmed archiving of the row whose sheet is open. */
function archiveMenuItem() {
  if (menuItem.value) emit('archive', menuItem.value)
}
</script>

<template>
  <div class="rows" :style="{ '--rows-columns': gridColumns }" data-testid="admin-rows">
    <div class="rows__head" aria-hidden="true">
      <span v-for="column in columns" :key="column">{{ t(`admin.col.${column}`) }}</span>
      <span />
    </div>
    <ul class="rows__list">
      <li
        v-for="item in items"
        :key="item.id"
        class="rows__row"
        :class="{ 'rows__row--works': isWorks }"
        data-testid="admin-row"
      >
        <div class="rows__main">
          <WorkCover v-if="isWorks" size="sm" class="rows__cover" />
          <div class="rows__title">
            <NuxtLink :to="localePath(adminEditPath(kind, item.id))" class="rows__name">
              {{ itemLabel(item) }}
            </NuxtLink>
            <span
              v-if="subtitle(item)"
              class="rows__sub"
              :class="{ 'rows__sub--active': !item.archived }"
              >{{ subtitle(item) }}</span
            >
          </div>
        </div>
        <span class="rows__summary" data-testid="admin-row-summary">{{ summary(item) }}</span>
        <template v-if="isWorks">
          <span class="rows__cell" :data-label="t('admin.col.typeFormat')">
            {{ typeAndFormat(item) }}
          </span>
          <span class="rows__cell" :data-label="t('admin.col.author')">
            {{ item.mainAuthor ?? '—' }}
          </span>
          <span class="rows__cell" :data-label="t('admin.col.status')">
            <span v-if="item.status" class="rows__status">
              {{ t(`admin.option.workStatus.${item.status}`) }}
            </span>
          </span>
          <span class="rows__cell rows__meter-cell" :data-label="t('admin.col.completeness')">
            <span class="rows__meter" aria-hidden="true">
              <span class="rows__meter-fill" :style="{ width: `${item.completeness ?? 0}%` }" />
            </span>
            <span class="rows__percent" aria-hidden="true">{{ item.completeness ?? 0 }} %</span>
            <span class="sr-only" data-testid="admin-row-completeness">{{
              t('admin.row.completeness', { percent: item.completeness ?? 0 })
            }}</span>
          </span>
        </template>
        <template v-else>
          <span class="rows__cell" :data-label="t('admin.col.kindLabel')">{{
            kindLabel(item)
          }}</span>
          <span class="rows__cell" :data-label="t('admin.col.works')">
            {{ t('admin.row.worksCount', { count: item.activeWorkCount ?? 0 }) }}
          </span>
        </template>
        <UiButton
          v-if="item.archived"
          variant="secondary"
          size="small"
          class="rows__action"
          data-testid="admin-restore"
          @click="emit('restore', item)"
        >
          <Icon name="tabler:restore" size="16" aria-hidden="true" />{{ t('admin.restore') }}
        </UiButton>
        <UiButton
          v-else
          variant="secondary"
          size="small"
          class="rows__action"
          :to="localePath(adminEditPath(kind, item.id))"
          data-testid="admin-edit"
        >
          <Icon name="tabler:pencil" size="16" aria-hidden="true" />{{ t('action.edit') }}
        </UiButton>
        <button
          type="button"
          class="rows__more"
          :aria-label="t('admin.row.actions', { name: itemLabel(item) })"
          data-testid="admin-row-menu"
          @click="openMenu(item)"
        >
          <Icon name="tabler:dots-vertical" size="20" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <AdminRowMenu
      v-model="isMenuOpen"
      :kind="kind"
      :item="menuItem"
      @restore="emit('restore', $event)"
      @archive="askArchive"
    />
    <AdminArchiveConfirm
      v-model="isArchiveConfirmOpen"
      :kind="kind"
      :impact="impact"
      @confirm="archiveMenuItem"
    />
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.rows {
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow);
}

// Columns (`--rows-columns`, set by the component): wide record cell, cells, then the action.
.rows__head,
.rows__row {
  display: grid;
  grid-template-columns: var(--rows-columns);
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-3) var(--space-4);
}

.rows__head {
  border-bottom: var(--border);
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 800;
}

.rows__list {
  margin: 0;
  padding: 0;
}

.rows__row + .rows__row {
  border-top: 1px dashed var(--color-ink-soft);
}

.rows__main {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
}

.rows__title {
  display: grid;
  min-width: 0;
}

.rows__name {
  overflow-wrap: anywhere;
  color: var(--color-blue);
  font-weight: 800;
  text-decoration: none;

  // Same as the title of a My list row.
  @include on-hover {
    text-decoration: underline;
  }
}

.rows__sub {
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}

.rows__cell {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
}

.rows__status {
  display: inline-block;
  padding: 1px 9px;
  border: var(--border);
  border-radius: var(--radius);
  font-size: 0.75rem;
  font-weight: 800;
}

.rows__meter-cell {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.rows__meter {
  flex: 1;
  height: 10px;
  overflow: hidden;
  border: var(--border);
  border-radius: 999px;
  background: var(--color-surface);
}

.rows__meter-fill {
  display: block;
  height: 100%;
  background: var(--color-blue);
}

.rows__percent {
  font-size: 0.75rem;
  font-weight: 800;
}

.rows__action {
  justify-self: end;
}

// Mobile-only elements, hidden on desktop.
.rows__summary,
.rows__more {
  display: none;
}

// Mobile: title, one information line and the completeness; "⋮" opens the actions.
@media (max-width: 1023px) {
  .rows__head,
  .rows__action,
  .rows__cell:not(.rows__meter-cell),
  .rows__sub--active {
    display: none;
  }

  .rows__row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px var(--space-3);
    align-items: start;
  }

  // Cover, title, information and completeness become cells of one grid: the
  // cover spans the three text lines.
  .rows__main {
    display: contents;
  }

  .rows__title {
    grid-column: 1;
    grid-row: 1;
  }

  .rows__row--works {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .rows__row--works .rows__title {
    grid-column: 2;
  }

  .rows__row--works .rows__main .rows__cover {
    grid-column: 1;
    grid-row: 1 / span 3;
    align-self: center;
  }

  .rows__more {
    display: flex;
    grid-column: -2;
    grid-row: 1;
    align-items: center;
    justify-content: center;
    width: var(--touch);
    height: var(--touch);
    margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-ink);
    cursor: pointer;
  }

  .rows__summary,
  .rows__meter-cell {
    display: flex;
    grid-column: 1 / -1;
    color: var(--color-ink-soft);
    font-size: 0.8125rem;
  }

  .rows__row--works .rows__summary,
  .rows__row--works .rows__meter-cell {
    grid-column: 2 / -1;
  }

  .rows__meter-cell::before {
    display: none;
  }
}
</style>
