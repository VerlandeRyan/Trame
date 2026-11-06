import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest s'exécute depuis `web/`.
const appDirectory = resolve(process.cwd(), 'app')

// Garde-fou de #156 : ces petits liens reçoivent la zone tactile commune (mixin `touch-target`),
// jamais un `::after` recopié à la main.
const guards: [string, string][] = [
  ['assets/styles/main.scss', '.link-underlined'],
  ['components/layout/Header.vue', '.layout-header__logo'],
  ['layouts/signup.vue', '.signup-layout__logo'],
  ['components/search/ResultItem.vue', '.result__link'],
]

/** Le corps de la règle `selector { … }` (première occurrence, accolades équilibrées). */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  if (start === -1) return ''
  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++
    if (source[index] === '}' && --depth === 0) return source.slice(start, index)
  }
  return ''
}

describe('zones tactiles de 44 px', () => {
  it('lit le corps d’une règle', () => {
    expect(ruleBody('.a { color: red; .b { x: y } }\n.c { z: z }', '.a')).toContain('.b')
    expect(ruleBody('.a { color: red }', '.missing')).toBe('')
  })

  it.each(guards)('%s : `%s` inclut touch-target', (file, selector) => {
    const source = readFileSync(join(appDirectory, file), 'utf8')
    expect(ruleBody(source, selector)).toContain('@include touch-target')
  })

  it('le mixin ne joue qu’au doigt', () => {
    const mixins = readFileSync(join(appDirectory, 'assets/styles/_mixins.scss'), 'utf8')
    expect(ruleBody(mixins, '@mixin touch-target')).toContain('@media (pointer: coarse)')
  })
})
