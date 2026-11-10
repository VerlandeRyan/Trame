<script setup lang="ts">
import {
  CREDIT_ROLES,
  isCreditRowFilled,
  isPublisherRowFilled,
  isRelationRowFilled,
  optionsOf,
  RELATION_KINDS,
  type AdminKind,
  type RecordRef,
  type WorkDraft,
} from '~/utils/admin'

/**
 * What links the work to the rest of the catalogue: authors, publishers, related works (a single
 * relation per related work). `part`: "people" (authors and publishers) or "relations" (related
 * works), one tab each. `showErrors`: after a refused save, rows without a chosen record are marked.
 */
const props = defineProps<{
  part: 'people' | 'relations'
  search: (kind: AdminKind, text: string) => Promise<RecordRef[]>
  showErrors?: boolean
}>()
const draft = defineModel<WorkDraft>({ required: true })
const { t } = useI18n()
const roleOptions = optionsOf(CREDIT_ROLES, (code) => t(`admin.option.creditRole.${code}`))
const relationOptions = optionsOf(RELATION_KINDS, (code) => t(`admin.option.relation.${code}`))
/** Search function restricted to one kind of record. */
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
        :is-filled="isCreditRowFilled"
        columns="minmax(0, 1fr) 16rem"
        @add="draft.credits.push({ person: null, role: 'story' })"
        @remove="draft.credits.splice($event, 1)"
      >
        <template #default="{ item }">
          <AdminRecordPicker
            v-model="item.person"
            :label="t('admin.work.person')"
            :placeholder="t('admin.work.searchPerson')"
            :clear-label="t('action.clearChoice')"
            :search="searchIn('people')"
            :invalid="showErrors && item.person === null"
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
        :is-filled="isPublisherRowFilled"
        @add="draft.publishers.push({ publisher: null })"
        @remove="draft.publishers.splice($event, 1)"
      >
        <template #default="{ item }">
          <AdminRecordPicker
            v-model="item.publisher"
            :label="t('admin.work.publisher')"
            :placeholder="t('admin.work.searchPublisher')"
            :clear-label="t('action.clearChoice')"
            :search="searchIn('publishers')"
            :invalid="showErrors && item.publisher === null"
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
        :is-filled="isRelationRowFilled"
        columns="minmax(0, 1fr) 16rem"
        @add="draft.relations.push({ work: null, relation: 'sequel' })"
        @remove="draft.relations.splice($event, 1)"
      >
        <template #default="{ item }">
          <AdminRecordPicker
            v-model="item.work"
            :label="t('admin.work.relatedWork')"
            :placeholder="t('admin.work.searchWork')"
            :clear-label="t('action.clearChoice')"
            :search="searchIn('works')"
            :invalid="showErrors && item.work === null"
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
