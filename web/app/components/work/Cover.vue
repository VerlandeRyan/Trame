<script setup lang="ts">
// Couverture : avec image (liseré blanc, filet d'encre), sans image (trame bleue en fondu, pastille).
// Jamais de trame sur une image.
withDefaults(defineProps<{ url?: string; size?: 'normal' | 'small' }>(), {
  url: undefined,
  size: 'normal',
})
</script>

<template>
  <div class="cover" :class="[`cover--${size}`, url ? 'cover--image' : 'cover--empty']">
    <img v-if="url" :src="url" alt="" loading="lazy" />
    <span v-else class="cover__pad"><Icon name="tabler:photo" aria-hidden="true" /></span>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.cover {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

.cover--small {
  width: 72px;
  flex: none;
}

.cover--image {
  padding: 3px;

  img {
    width: 100%;
    height: 100%;
    border: 1px solid var(--color-ink);
    object-fit: cover;
    object-position: top center;
  }

  &.cover--small {
    padding: 2px;
  }
}

.cover--empty {
  background-color: var(--color-cover-empty);

  &::before {
    @include screentone(var(--color-blue), 9px, 150deg);
  }

  &.cover--small::before {
    background-size: 7px 7px;
  }
}

.cover__pad {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  border: var(--border);
  border-radius: 6px;
  background: var(--color-surface);
  font-size: 22px;
}

.cover--small .cover__pad {
  width: 26px;
  height: 26px;
  border-radius: var(--radius);
  font-size: 15px;
}
</style>
