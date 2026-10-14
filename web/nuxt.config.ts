// Langues d'interface : le français est la langue par défaut, sans préfixe d'URL (ADR 0007).
// Ajouter une langue = un fichier dans i18n/locales/ + une entrée ici ; le repli est le français.
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  ssr: true,

  modules: ['@nuxtjs/i18n', '@nuxt/icon', '@nuxt/eslint'],

  css: ['~/assets/styles/main.scss'],

  runtimeConfig: {
    // Surchargé par NUXT_API_BASE (serveur) : adresse interne de l'API.
    apiBase: 'http://localhost:3000',
    public: {
      // Page /components (galerie) : active hors production, ou via NUXT_PUBLIC_COMPONENT_GALLERY=true.
      componentGallery: process.env.NODE_ENV !== 'production',
    },
  },

  i18n: {
    defaultLocale: 'fr',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: false,
    // URL publique (liens hreflang) : valeur locale par défaut, à fournir par l'environnement ensuite.
    baseUrl: process.env.NUXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
    ],
    // Repli sur le français pour les clés absentes (voir i18n.config.ts).
    vueI18n: './i18n.config.ts',
  },

  icon: {
    // Icônes Tabler servies par notre propre serveur : pas de CDN ni de police d'icônes.
    provider: 'none',
    clientBundle: { scan: true },
    serverBundle: { collections: ['tabler'] },
  },

  app: {
    head: {
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
})
