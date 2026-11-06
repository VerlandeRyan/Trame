import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest s'exécute depuis `web/`.
const appDirectory = resolve(process.cwd(), 'app')

function styleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return styleFiles(path)
    return /\.(vue|scss)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : []
  })
}

// Garde-fou de #164 : le survol d'un bouton coloré change un fond explicite, jamais un filtre
// (le texte et le cadre s'assombriraient avec lui).
describe('règles de survol', () => {
  it("n'utilise aucun filtre `brightness()`", () => {
    const offenders = styleFiles(appDirectory).filter((path) =>
      readFileSync(path, 'utf8').includes('brightness('),
    )
    expect(offenders).toEqual([])
  })
})

/** Le source sans les blocs `@include on-hover { … }` (accolades équilibrées). */
function withoutHoverBlocks(source: string): string {
  let result = source
  for (let start = result.indexOf('@include on-hover'); start !== -1;) {
    let depth = 0
    let end = result.indexOf('{', start)
    for (; end < result.length; end++) {
      if (result[end] === '{') depth++
      if (result[end] === '}' && --depth === 0) break
    }
    result = result.slice(0, start) + result.slice(end + 1)
    start = result.indexOf('@include on-hover')
  }
  return result
}

/** Classes dont la règle souligne le texte au repos (hors survol et hors état `&.classe`). */
function classesUnderlinedAtRest(source: string): string[] {
  return [
    ...withoutHoverBlocks(source).matchAll(
      /(?<![&\w-])\.([\w-]+)\s*\{[^{}]*text-decoration:\s*underline;/g,
    ),
  ].map((match) => match[1]!)
}

function hasLinkUnderlinedClass(source: string, className: string): boolean {
  return [...source.matchAll(/class="([^"]*)"/g)].some((match) => {
    const names = match[1]!.split(/\s+/)
    return names.includes(className) && names.includes('link-underlined')
  })
}

// Garde-fou de #164 : un lien ou un bouton-texte souligné au repos reçoit `.link-underlined`,
// sinon son survol n'a aucun signal (règle 5).
describe('liens soulignés au repos', () => {
  it('repère une règle qui souligne au repos, pas celle qui souligne au survol', () => {
    const source =
      '.a { color: red; text-decoration: underline; }\n.b { @include on-hover { text-decoration: underline; } }'
    expect(classesUnderlinedAtRest(source)).toEqual(['a'])
  })

  it('reconnaît la classe `link-underlined` sur le même élément', () => {
    expect(hasLinkUnderlinedClass('<a class="x link-underlined">', 'x')).toBe(true)
    expect(hasLinkUnderlinedClass('<a class="x">', 'x')).toBe(false)
  })

  it('porte `.link-underlined` sur tout élément souligné au repos', () => {
    const offenders = styleFiles(appDirectory).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return classesUnderlinedAtRest(source)
        .filter((className) => className !== 'link-underlined')
        .filter((className) => !hasLinkUnderlinedClass(source, className))
        .map((className) => `${path} : .${className}`)
    })
    expect(offenders).toEqual([])
  })
})

// Garde-fou de #165 : le survol et l'appui ne changent pas le choix courant d'un menu ou d'un groupe
// de pastilles (règle « Sélectionné » des conventions).
describe('survol du choix courant', () => {
  const guards: [string, string][] = [
    ['components/library/StatusMenu.vue', "&:not([aria-checked='true']"],
    ['components/list/StatusPicker.vue', "&:not([aria-checked='true']"],
    ['components/admin/PillGroup.vue', '&:not(:has(input:checked))'],
  ]

  it.each(guards)('%s exclut le choix courant du survol (`%s`)', (file, guard) => {
    expect(readFileSync(join(appDirectory, file), 'utf8')).toContain(guard)
  })
})
