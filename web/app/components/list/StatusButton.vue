<script setup lang="ts">
import type { LibraryStatus } from '~/utils/library'

// Statut d'une œuvre de la liste : bouton à sa couleur qui ouvre le menu des cinq statuts.
defineProps<{ status: LibraryStatus; title: string }>()
const emit = defineEmits<{ change: [status: LibraryStatus] }>()
const { t } = useI18n()
</script>

<template>
  <LibraryStatusList :status="status" testid-prefix="list-status" @change="emit('change', $event)">
    <template #trigger="{ isOpen, menuId, toggle }">
      <UiButton
        size="small"
        :status="status"
        class="status-button"
        aria-haspopup="menu"
        :aria-expanded="isOpen"
        :aria-controls="menuId"
        :aria-label="t('list.changeStatus', { title })"
        data-testid="list-status"
        @click="toggle"
      >
        {{ t(`readingStatus.${status}`) }}
        <Icon name="tabler:chevron-down" size="14" aria-hidden="true" />
      </UiButton>
    </template>
  </LibraryStatusList>
</template>

<style scoped lang="scss">
.status-button {
  font-size: 0.75rem;
  font-weight: 800;
  white-space: nowrap;
}
</style>
