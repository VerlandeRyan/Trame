/**
 * Nuxt configuration. Interface languages: French is the default, without a URL prefix.
 * Adding a language = a file in i18n/locales/ + an entry here; the fallback is French.
 */
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  ssr: true,

  modules: ['@nuxtjs/i18n', '@nuxt/icon', '@nuxt/eslint'],

  // Poppins 800, Latin subset only (OFL licence, served by our own server).
  css: ['@fontsource/poppins/latin-800.css', '~/assets/styles/main.scss'],

  runtimeConfig: {
    // Overridden by NUXT_API_BASE (server): internal address of the API.
    apiBase: 'http://localhost:3000',
    public: {
      // Component gallery page: enabled outside production, or via NUXT_PUBLIC_COMPONENT_GALLERY=true.
      componentGallery: process.env.NODE_ENV !== 'production',
    },
  },

  // Base headers on every response, API relay included. A CSP will come separately (nonce).
  routeRules: {
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  },

  i18n: {
    defaultLocale: 'fr',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: false,
    // Public URL (hreflang links): local default, to be provided by the environment later.
    baseUrl: process.env.NUXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
    ],
    // Falls back to French for missing keys (see i18n.config.ts).
    vueI18n: './i18n.config.ts',
  },

  icon: {
    // Tabler icons served by our own server: no CDN and no icon font.
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
