import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest s'exécute depuis `web/`.
const appDirectory = resolve(process.cwd(), 'app')
const readSource = (file: string) => readFileSync(join(appDirectory, file), 'utf8')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

/** Corps de la règle `.className { … }` (accolades équilibrées), ou `null` si elle n'existe pas. */
function ruleBody(source: string, className: string): string | null {
  // Règle de premier niveau seulement : les règles imbriquées sont indentées.
  const start = source.indexOf(`\n.${className} {`) + 1
  if (start === 0) return null
  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1)
  }
  return null
}

// Garde-fou de #200 : tous les menus déroulants s'ouvrent avec la même animation, déclarée une seule
// fois (mixin `menu-open-animation`) et désactivée si l'utilisateur réduit les animations.
describe("animation d'ouverture des menus", () => {
  const menus: { file: string; menu: string; above?: string }[] = [
    { file: 'components/ui/Select.vue', menu: 'select__menu', above: 'select__menu--above' },
    {
      file: 'components/ui/MultiSelect.vue',
      menu: 'multi-select__panel',
      above: 'multi-select__panel--above',
    },
    {
      file: 'components/admin/RecordPicker.vue',
      menu: 'picker__results',
      above: 'picker__results--above',
    },
    {
      file: 'components/admin/TagPicker.vue',
      menu: 'tags__proposals',
      above: 'tags__proposals--above',
    },
    {
      file: 'components/library/StatusList.vue',
      menu: 'status-list__panel',
      above: 'status-list__panel--above',
    },
    { file: 'components/layout/LanguageSwitcher.vue', menu: 'language-switcher__menu' },
    { file: 'components/layout/ExploreMenu.vue', menu: 'explore-menu__panel' },
    { file: 'components/layout/AccountMenu.vue', menu: 'account-menu__panel' },
    { file: 'components/layout/SearchBox.vue', menu: 'search-box__menu' },
  ]

  it("déclare l'animation une fois, dans `prefers-reduced-motion: no-preference`", () => {
    const mixins = readSource('assets/styles/_mixins.scss')
    const body = /@mixin menu-open-animation[^{]*\{([\s\S]*?)\n\}/.exec(mixins)?.[1] ?? ''
    expect(body).toContain('@media (prefers-reduced-motion: no-preference)')
    expect(body).toContain('animation:')
    expect(body).not.toContain('!important')
  })

  it.each(menus)('$file anime $menu avec le mixin commun', ({ file, menu, above }) => {
    const source = readSource(file)
    expect(ruleBody(source, menu)).toContain('@include menu-open-animation')
    if (above)
      expect(ruleBody(source, above)).toContain('@include menu-open-animation($above: true)')
  })

  it("ne garde aucune animation d'ouverture recopiée dans un composant", () => {
    const offenders = sourceFiles(appDirectory).filter((path) =>
      /@keyframes\s+[\w-]*menu-in/.test(readFileSync(path, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})

// Garde-fou de #200 : le tri encadré a une seule forme au mobile, portée par `UiSelect` ; aucune page
// ne masque ou ne réaffiche sa valeur de son côté.
describe('tri encadré au mobile', () => {
  it('masque la valeur sous 768 px dans UiSelect boxed', () => {
    const boxed = ruleBody(readSource('components/ui/Select.vue'), 'select--boxed') ?? ''
    expect(boxed).toContain('@media (max-width: 767px)')
    expect(boxed).toContain('.select__value')
  })

  it('ouvre le menu au clic sur toute la surface du cadre', () => {
    const boxed = ruleBody(readSource('components/ui/Select.vue'), 'select--boxed') ?? ''
    expect(boxed).toMatch(/&::before\s*\{[^}]*inset: 0/)
  })

  it("n'est reformaté par aucune page", () => {
    const offenders = sourceFiles(join(appDirectory, 'pages')).filter((path) =>
      readFileSync(path, 'utf8').includes('.select__value'),
    )
    expect(offenders).toEqual([])
  })
})
