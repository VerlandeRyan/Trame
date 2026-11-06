import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest s'exécute depuis `web/`.
const appDirectory = resolve(process.cwd(), 'app')
const readSource = (file: string) => readFileSync(join(appDirectory, file), 'utf8')

// Garde-fou de #154 : les onglets soulignés (`UiTabs underline`) et la barre de l'administration
// partagent un seul style, déclaré dans le mixin `underline-tab` et le mixin `underline-tab-bar`.
describe('onglets soulignés', () => {
  const mixins = readSource('assets/styles/_mixins.scss')

  it('déclare le trait de survol, d’appui et actif une seule fois', () => {
    const body = /@mixin underline-tab\([^{]*\{([\s\S]*?)\n\}/.exec(mixins)?.[1] ?? ''
    expect(body).toContain('@include on-hover')
    expect(body).toContain('--color-blue-line')
    expect(body).toContain('--color-blue')
  })

  it('déclare le filet d’encre de la barre dans un mixin commun', () => {
    const body = /@mixin underline-tab-bar\b[^{]*\{([\s\S]*?)\n\}/.exec(mixins)?.[1] ?? ''
    expect(body).toContain('inset 0 -3px 0 var(--color-ink)')
  })

  it.each(['components/ui/Tabs.vue', 'components/admin/Nav.vue'])(
    '%s utilise les mixins communs',
    (file) => {
      const source = readSource(file)
      expect(source).toContain('@include underline-tab-bar')
      expect(source).toContain('@include underline-tab')
    },
  )
})
