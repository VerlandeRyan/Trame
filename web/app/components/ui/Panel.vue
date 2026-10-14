<template>
  <div class="panel"><slot /></div>
</template>

<style scoped lang="scss">
// Panneau blanc à contour et ombre d'encre : conteneur générique des blocs de contenu.
.panel {
  padding: 14px 16px;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}
</style>
