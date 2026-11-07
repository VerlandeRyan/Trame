import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest s'exécute depuis `web/`.
const readSource = (file: string) => readFileSync(join(resolve(process.cwd(), 'app'), file), 'utf8')

/** Corps de la règle `.className { … }` de premier niveau (accolades équilibrées). */
function ruleBody(source: string, className: string): string {
  const start = source.indexOf(`\n.${className} {`) + 1
  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1)
  }
  return ''
}

// Garde-fous de #206 : à 768 px (iPad mini) la mise en page « bureau » s'appliquait trop tôt (titres
// écrits lettre par lettre, mots coupés, statuts sur deux lignes). Jusqu'à 1023 px, on garde la
// mise en page du téléphone là où le bureau est trop serré.
describe('tableau de « Ma liste »', () => {
  it('une ligne reste une carte jusqu’à 1023 px', () => {
    const row = readSource('components/list/Row.vue')

    expect(row).not.toContain('(min-width: 768px)')
    expect(row).not.toContain('(max-width: 767px)')
    expect(row).toContain('(min-width: 1024px)')
    expect(row).toContain('(max-width: 1023px)')
  })

  it.each([
    ['pages/list.vue', 'list__columns'],
    ['pages/u/[handle]/list.vue', 'member-list__columns'],
  ])('l’en-tête de colonnes de %s n’apparaît qu’à partir de 1024 px', (file, className) => {
    const body = ruleBody(readSource(file), className)

    expect(body).toContain('(min-width: 1024px)')
    expect(body).not.toContain('(min-width: 768px)')
  })
})

describe('« Reprendre la lecture » de l’accueil', () => {
  it('n’aligne que deux cartes entre 768 et 1023 px, trois à partir de 1024 px', () => {
    const source = readSource('components/home/ContinueReading.vue')
    const list = ruleBody(source, 'continue-reading__list')

    expect(list).toContain('repeat(var(--continue-reading-shown), minmax(0, 1fr))')
    expect(list).not.toContain('repeat(var(--continue-reading-count),')
    const root = ruleBody(source, 'continue-reading')
    expect(root).toContain('--continue-reading-columns: 2')
    expect(root).toContain('(min-width: 1024px)')
    expect(root).toContain('--continue-reading-columns: 3')
  })
})

describe('suggestions de recherche du header', () => {
  it('la liste est plus large que le champ dès 768 px, pour que les titres respirent', () => {
    const menu = ruleBody(readSource('components/layout/SearchBox.vue'), 'search-box__menu')

    expect(menu).toContain('(min-width: 768px)')
    expect(menu).toContain('width: max(100%, 22rem)')
  })
})

describe('recherche du catalogue d’administration', () => {
  it('prend sa propre rangée jusqu’à 1279 px, les filtres passent dessous', () => {
    const search = ruleBody(readSource('pages/admin/catalogue/index.vue'), 'catalogue__search')

    expect(search).toContain('(max-width: 1279px)')
    expect(search).toContain('flex-basis: 100%')
  })
})

describe('catalogue d’administration', () => {
  it.each(['components/admin/ResourceRows.vue', 'components/admin/Filters.vue'])(
    '%s garde la mise en page du téléphone jusqu’à 1023 px',
    (file) => {
      const source = readSource(file)

      expect(source).not.toContain('(max-width: 767px)')
      expect(source).toContain('(max-width: 1023px)')
    },
  )
})
