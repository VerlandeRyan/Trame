import withNuxt from './.nuxt/eslint.config.mjs'

// Règles renforcées, reprises de hortibat_frontend pour garder des composants simples.
export default withNuxt({
  files: ['**/*.vue'],
  rules: {
    // Aligné sur Prettier, qui écrit `<input />` (le formateur fait foi).
    'vue/html-self-closing': ['error', { html: { void: 'always' } }],
    'vue/max-props': ['error', { maxProps: 6 }],
    'vue/max-template-depth': ['error', { maxDepth: 8 }],
    'vue/no-ref-object-reactivity-loss': 'error',
    'vue/no-unused-properties': 'error',
    'vue/no-unused-refs': 'error',
    'vue/require-typed-ref': 'error',
  },
})
