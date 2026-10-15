import { defineConfig, devices } from '@playwright/test'

// Deux instances du même build : la galerie de composants activée (par défaut) et désactivée
// (comme en production), pour vérifier qu'elle y répond 404.
const PORT = 3200
const PORT_GALLERY_OFF = 3201
// Doublure de l'API (support/api-stub.mjs) : les parcours du front n'ont besoin d'aucune base.
const PORT_API_STUB = 3202
const API_STUB_URL = `http://127.0.0.1:${PORT_API_STUB}`

// Le front doit être construit avant (npm run build dans web/) : on teste la sortie réelle de Nitro.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node support/api-stub.mjs',
      url: `${API_STUB_URL}/health`,
      env: { STUB_API_PORT: String(PORT_API_STUB) },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'node ../web/.output/server/index.mjs',
      url: `http://127.0.0.1:${PORT}`,
      env: {
        PORT: String(PORT),
        NITRO_HOST: '127.0.0.1',
        NUXT_PUBLIC_COMPONENT_GALLERY: 'true',
        NUXT_API_BASE: API_STUB_URL,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'node ../web/.output/server/index.mjs',
      url: `http://127.0.0.1:${PORT_GALLERY_OFF}`,
      env: { PORT: String(PORT_GALLERY_OFF), NITRO_HOST: '127.0.0.1', NUXT_API_BASE: API_STUB_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'] } },
  ],
})
