<script setup lang="ts">
import { optionsOf, type AdminLink } from '~/utils/admin'

// Liens externes (https) d'une œuvre ou d'une personne, chacun dans une carte ; `kinds` limite les
// types proposés (le premier est celui d'un nouveau lien).
const props = defineProps<{ kinds: readonly AdminLink['kind'][] }>()
const links = defineModel<{ kind: string; url: string; label: string }[]>({ required: true })
const { t } = useI18n()
const uid = useId()
const kindOptions = optionsOf(props.kinds, (code) => t(`admin.option.link.${code}`))
</script>

<template>
  <AdminRowList
    :items="links"
    :add-label="t('admin.links.add')"
    :remove-label="t('admin.links.remove')"
    :row-label="t('admin.links.row')"
    columns="14rem minmax(0, 1fr) minmax(0, 14rem)"
    @add="links.push({ kind: kinds[0] ?? 'read', url: '', label: '' })"
    @remove="links.splice($event, 1)"
  >
    <template #default="{ item, index }">
      <AdminSelectField v-model="item.kind" :options="kindOptions" :label="t('admin.links.kind')" />
      <UiField
        :id="`${uid}-url-${index}`"
        v-model="item.url"
        :label="t('admin.links.url')"
        :input-attributes="{ type: 'url', autocomplete: 'off' }"
      />
      <UiField
        :id="`${uid}-label-${index}`"
        v-model="item.label"
        :label="t('admin.links.label')"
        :input-attributes="{ maxlength: 100 }"
      />
    </template>
  </AdminRowList>
</template>
