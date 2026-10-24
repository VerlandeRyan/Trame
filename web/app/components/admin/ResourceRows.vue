<script setup lang="ts">
import { adminEditPath, itemLabel, type AdminKind, type AdminListItem } from '~/utils/admin'
import { updateAge } from '~/utils/profile'

// Tableau du catalogue (maquette 22) : une ligne par fiche, « Modifier » ou, pour une archive,
// « Restaurer ». Archiver se fait depuis la fiche.
const props = defineProps<{ kind: AdminKind; items: AdminListItem[] }>()
const emit = defineEmits<{ restore: [item: AdminListItem]; archive: [item: AdminListItem] }>()
const { t } = useI18n()
const localePath = useLocalePath()

const isWorks = computed(() => props.kind === 'works')
const columns = computed(() =>
  isWorks.value
    ? ['work', 'typeFormat', 'author', 'status', 'completeness']
    : ['name', 'kindLabel', 'works'],
)

const ACTION_COLUMN = '7.5rem'
const gridColumns = computed(() =>
  isWorks.value
    ? `minmax(0, 3fr) minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.4fr) ${ACTION_COLUMN}`
    : `minmax(0, 3fr) minmax(0, 1fr) minmax(0, 1fr) ${ACTION_COLUMN}`,
)

const ageLabel = (iso: string | null | undefined) => {
  if (!iso) return ''
  const age = updateAge(iso)
  const label =
    'count' in age
      ? t(`profile.age.${age.unit}`, { count: age.count })
      : t(`profile.age.${age.unit}`)
  return label.toLowerCase()
}

function subtitle(item: AdminListItem): string {
  if (!item.archived)
    return item.updatedAt ? t('admin.row.updated', { age: ageLabel(item.updatedAt) }) : ''
  return t('admin.row.archivedBy', {
    age: ageLabel(item.archivedAt),
    handle: item.archivedBy ?? '?',
  })
}

const genreLabel = useGenreLabel()
function typeAndFormat(item: AdminListItem): string {
  const type = item.type ? t(`admin.option.workType.${item.type}`) : ''
  return [type, ...(item.formats ?? []).map(genreLabel)].filter(Boolean).join(' · ')
}

function kindLabel(item: AdminListItem): string {
  const group = props.kind === 'people' ? 'person' : 'publisher'
  return item.kind ? t(`admin.option.${group}.${item.kind}`) : ''
}

// Mobile : une seule ligne d'information sous le titre, comme la maquette 6.
function summary(item: AdminListItem): string {
  const parts = isWorks.value
    ? [typeAndFormat(item), item.status ? t(`admin.option.workStatus.${item.status}`) : '']
    : [kindLabel(item), t('admin.row.worksCount', { count: item.activeWorkCount ?? 0 })]
  return parts.filter(Boolean).join(' · ')
}

// Mobile : les actions d'une fiche sont dans une feuille ouverte par « ⋮ » (maquette 7).
const menuItem = ref<AdminListItem | null>(null)
const isMenuOpen = ref(false)
function openMenu(item: AdminListItem) {
  menuItem.value = item
  isMenuOpen.value = true
}
function restoreFromMenu(item: AdminListItem) {
  isMenuOpen.value = false
  emit('restore', item)
}

// L'archivage demande confirmation, comme depuis la fiche.
const isArchiveConfirmOpen = ref(false)
function askArchive() {
  isMenuOpen.value = false
  isArchiveConfirmOpen.value = true
}
function archiveMenuItem() {
  if (menuItem.value) emit('archive', menuItem.value)
}
const editLocation = (item: AdminListItem, section?: string) =>
  localePath({ path: adminEditPath(props.kind, item.id), query: section ? { section } : {} })
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
          <WorkCover v-if="isWorks" size="small" class="rows__cover" />
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
          <Icon name="tabler:pencil" size="16" aria-hidden="true" />{{ t('admin.edit') }}
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
    <UiModal
      v-model="isMenuOpen"
      placement="bottom"
      :title="menuItem ? itemLabel(menuItem) : ''"
      :close-label="t('action.close')"
    >
      <div v-if="menuItem" class="rows__menu">
        <UiButton
          v-if="menuItem.archived"
          variant="secondary"
          class="rows__menu-item"
          data-testid="admin-menu-restore"
          @click="restoreFromMenu(menuItem)"
        >
          <Icon name="tabler:restore" size="16" aria-hidden="true" />{{ t('admin.restore') }}
        </UiButton>
        <template v-else>
          <UiButton
            variant="secondary"
            class="rows__menu-item"
            :to="editLocation(menuItem)"
            data-testid="admin-menu-edit"
          >
            <Icon name="tabler:pencil" size="16" aria-hidden="true" />{{ t('admin.row.menu.edit') }}
          </UiButton>
          <UiButton
            v-if="isWorks"
            variant="secondary"
            class="rows__menu-item"
            :to="editLocation(menuItem, 'relations')"
            data-testid="admin-menu-relations"
          >
            <Icon name="tabler:link" size="16" aria-hidden="true" />{{
              t('admin.row.menu.relations')
            }}
          </UiButton>
          <UiButton
            variant="danger"
            class="rows__menu-item"
            data-testid="admin-menu-archive"
            @click="askArchive"
          >
            <Icon name="tabler:archive" size="16" aria-hidden="true" />{{ t('admin.archive') }}
          </UiButton>
        </template>
      </div>
    </UiModal>
    <UiConfirm
      v-model="isArchiveConfirmOpen"
      danger
      :title="t('admin.archiveConfirm.title')"
      :text="t(`admin.archiveConfirm.text.${kind}`)"
      :confirm-label="t('admin.archiveConfirm.confirm')"
      :cancel-label="t('admin.archiveConfirm.cancel')"
      :close-label="t('action.close')"
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

// Colonnes (`--rows-columns`, posée par le composant) : fiche large, cellules, puis l'action.
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

.rows__row {
  @include on-hover {
    background: var(--color-field-soft);
  }
}

.rows__main {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
}

.rows__cover {
  flex: none;
  width: 40px;
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

// Éléments propres au mobile, masqués au bureau.
.rows__summary,
.rows__more {
  display: none;
}

.rows__menu {
  display: grid;
  gap: var(--space-3);
}

.rows__menu-item {
  justify-content: flex-start;
}

// Mobile (maquette 6) : titre, une ligne d'information et la complétude ; « ⋮ » ouvre les actions.
@media (max-width: 767px) {
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

  // Couverture, titre, information et complétude deviennent les cases d'une même grille : la
  // couverture s'étend sur les trois lignes de texte (maquette 6).
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
    // Même format 2 / 3 sur toutes les lignes (jamais étirée) : elle donne sa hauteur à la ligne.
    width: 52px;
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
