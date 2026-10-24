<script setup lang="ts">
import {
  CREDIT_ROLES,
  optionsOf,
  RELATION_KINDS,
  type AdminKind,
  type RecordRef,
  type WorkDraft,
} from '~/utils/admin'

// Ce qui relie l'œuvre au reste du catalogue : auteurs, éditeurs, œuvres liées (RG-17 : une seule
// relation par œuvre liée).
// `part` : « people » (auteurs et éditeurs) ou « relations » (œuvres liées), un onglet chacun.
const props = defineProps<{
  part: 'people' | 'relations'
  search: (kind: AdminKind, text: string) => Promise<RecordRef[]>
}>()
const draft = defineModel<WorkDraft>({ required: true })
const { t } = useI18n()
const roleOptions = optionsOf(CREDIT_ROLES, (code) => t(`admin.option.creditRole.${code}`))
const relationOptions = optionsOf(RELATION_KINDS, (code) => t(`admin.option.relation.${code}`))
const searchIn = (kind: AdminKind) => (text: string) => props.search(kind, text)
</script>

<template>
  <div class="related">
    <AdminPanel v-if="part === 'people'" :title="t('admin.work.credits')">
      <AdminRowList
        :items="draft.credits"
        :add-label="t('admin.work.addCredit')"
        :remove-label="t('admin.work.removeCredit')"
        :row-label="t('admin.work.creditRow')"
        columns="minmax(0, 1fr) 16rem"
        @add="draft.credits.push({ person: null, role: 'story' })"
        @remove="draft.credits.splice($event, 1)"
      >
        <template #default="{ item }">
          <AdminRecordPicker
            v-model="item.person"
            :label="t('admin.work.person')"
            :placeholder="t('admin.work.searchPerson')"
            :clear-label="t('admin.work.clearChoice')"
            :search="searchIn('people')"
          />
          <AdminSelectField
            v-model="item.role"
            :options="roleOptions"
            :label="t('admin.work.role')"
          />
        </template>
      </AdminRowList>
    </AdminPanel>
    <AdminPanel v-if="part === 'people'" :title="t('admin.work.publishers')">
      <AdminRowList
        :items="draft.publishers"
        :add-label="t('admin.work.addPublisher')"
        :remove-label="t('admin.work.removePublisher')"
        :row-label="t('admin.work.publisherRow')"
        @add="draft.publishers.push({ publisher: null })"
        @remove="draft.publishers.splice($event, 1)"
      >
        <template #default="{ item }">
          <AdminRecordPicker
            v-model="item.publisher"
            :label="t('admin.work.publisher')"
            :placeholder="t('admin.work.searchPublisher')"
            :clear-label="t('admin.work.clearChoice')"
            :search="searchIn('publishers')"
          />
        </template>
      </AdminRowList>
    </AdminPanel>
    <AdminPanel v-else :title="t('admin.work.relations')" :hint="t('admin.work.relationHint')">
      <AdminRowList
        :items="draft.relations"
        :add-label="t('admin.work.addRelation')"
        :remove-label="t('admin.work.removeRelation')"
        :row-label="t('admin.work.relationRow')"
        columns="minmax(0, 1fr) 16rem"
        @add="draft.relations.push({ work: null, relation: 'sequel' })"
        @remove="draft.relations.splice($event, 1)"
      >
        <template #default="{ item }">
          <AdminRecordPicker
            v-model="item.work"
            :label="t('admin.work.relatedWork')"
            :placeholder="t('admin.work.searchWork')"
            :clear-label="t('admin.work.clearChoice')"
            :search="searchIn('works')"
          />
          <AdminSelectField
            v-model="item.relation"
            :options="relationOptions"
            :label="t('admin.work.relation')"
          />
        </template>
      </AdminRowList>
    </AdminPanel>
  </div>
</template>

<style scoped lang="scss">
.related {
  display: grid;
  gap: var(--space-6);
}
</style>
