<script setup lang="ts">
import { adminEditPath, itemLabel, type AdminKind, type AdminListItem } from '~/utils/admin'

// Feuille d'actions d'une fiche, ouverte par « ⋮ » au mobile (maquette 7). Archiver ne se fait pas
// ici : le parent ouvre sa confirmation (`archive`).
const props = defineProps<{ kind: AdminKind; item: AdminListItem | null }>()
const isOpen = defineModel<boolean>({ default: false })
const emit = defineEmits<{ restore: [item: AdminListItem]; archive: [item: AdminListItem] }>()
const { t } = useI18n()
const localePath = useLocalePath()

const isWorks = computed(() => props.kind === 'works')

const editLocation = (item: AdminListItem, section?: string) =>
  localePath({ path: adminEditPath(props.kind, item.id), query: section ? { section } : {} })

function restore(item: AdminListItem) {
  isOpen.value = false
  emit('restore', item)
}

function askArchive(item: AdminListItem) {
  isOpen.value = false
  emit('archive', item)
}
</script>

<template>
  <UiModal
    v-model="isOpen"
    placement="bottom"
    :title="item ? itemLabel(item) : ''"
    :close-label="t('action.close')"
  >
    <div v-if="item" class="row-menu">
      <UiButton
        v-if="item.archived"
        variant="secondary"
        class="row-menu__item"
        data-testid="admin-menu-restore"
        @click="restore(item)"
      >
        <Icon name="tabler:restore" size="16" aria-hidden="true" />{{ t('admin.restore') }}
      </UiButton>
      <template v-else>
        <UiButton
          variant="secondary"
          class="row-menu__item"
          :to="editLocation(item)"
          data-testid="admin-menu-edit"
        >
          <Icon name="tabler:pencil" size="16" aria-hidden="true" />{{ t('admin.row.menu.edit') }}
        </UiButton>
        <UiButton
          v-if="isWorks"
          variant="secondary"
          class="row-menu__item"
          :to="editLocation(item, 'relations')"
          data-testid="admin-menu-relations"
        >
          <Icon name="tabler:link" size="16" aria-hidden="true" />{{
            t('admin.row.menu.relations')
          }}
        </UiButton>
        <UiButton
          variant="danger"
          class="row-menu__item"
          data-testid="admin-menu-archive"
          @click="askArchive(item)"
        >
          <Icon name="tabler:archive" size="16" aria-hidden="true" />{{ t('admin.archive') }}
        </UiButton>
      </template>
    </div>
  </UiModal>
</template>

<style scoped lang="scss">
.row-menu {
  display: grid;
  gap: var(--space-3);
}

.row-menu__item {
  justify-content: flex-start;
}
</style>
