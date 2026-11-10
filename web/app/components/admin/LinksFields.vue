<script setup lang="ts">
import { isLinkRowFilled, optionsOf, type AdminLink } from '~/utils/admin'

/**
 * External (https) links of a work or a person, each in a card; `kinds` limits the offered
 * kinds (the first one is that of a new link).
 */
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
    :is-filled="isLinkRowFilled"
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
