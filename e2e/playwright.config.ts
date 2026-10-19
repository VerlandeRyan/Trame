import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// `.env` racine pour le développement local (sans écraser une variable déjà définie, ex. en CI).
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
} catch {
  // Pas de .env : les variables viennent de l'environnement.
}

// La vraie API tourne sur la base de TEST, rechargée avec le jeu de démo (support/global-setup.ts).
const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL manquante (voir .env.example) : les E2E lisent la vraie API.')
}

// Deux instances du même build : la galerie de composants activée (par défaut) et désactivée
// (comme en production), pour vérifier qu'elle y répond 404.
const PORT = 3200
const PORT_GALLERY_OFF = 3201
const PORT_API = 3202
const API_URL = `http://127.0.0.1:${PORT_API}`

// Le front et l'API doivent être construits avant (npm run build dans web/ et api/) : on teste la
// sortie réelle de Nitro et le serveur compilé.
export default defineConfig({
  testDir: './tests',
  globalSetup: './support/global-setup.ts',
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
      command: 'node ../api/dist/server.js',
      url: `${API_URL}/health`,
      env: {
        DATABASE_URL: testDatabaseUrl,
        PORT: String(PORT_API),
        NODE_ENV: 'production',
        // Valeurs propres aux E2E : API en HTTP local, donc cookies non `Secure`.
        SESSION_SECRET: 'e2e-only-session-secret-not-for-real-use',
        SECURE_COOKIES: 'false',
      },
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
        NUXT_API_BASE: API_URL,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'node ../web/.output/server/index.mjs',
      url: `http://127.0.0.1:${PORT_GALLERY_OFF}`,
      env: { PORT: String(PORT_GALLERY_OFF), NITRO_HOST: '127.0.0.1', NUXT_API_BASE: API_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'] } },
  ],
})
