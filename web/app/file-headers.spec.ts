/** Documentation convention check: every source file starts with a one-line description comment. */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const APP_ROOT = path.dirname(fileURLToPath(import.meta.url))
/** Files that are generated or are tests: not commented element by element. */
const EXEMPT = /\.spec\.ts$|api-schema\.ts$/

/** Lists the TypeScript and Vue files under a folder, recursively. */
function listSourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(folder, entry.name)
    if (entry.isDirectory()) return listSourceFiles(entryPath)
    const isSource = /\.(ts|vue)$/.test(entry.name) && !EXEMPT.test(entryPath)
    return isSource ? [entryPath] : []
  })
}

/** The first line of a Vue script that is not part of an import statement. */
function firstStatementOfScript(content: string): string {
  const start = content.indexOf('<script')
  const body = content.slice(content.indexOf('>', start) + 1)
  let isInImport = false
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (isInImport) isInImport = !/['"];?$/.test(trimmed)
    else if (trimmed.startsWith('import ')) isInImport = !/['"];?$/.test(trimmed)
    else if (trimmed !== '') return trimmed
  }
  return ''
}

/** The text that must start with the description comment: the file, or a Vue script's content. */
function headerSource(file: string, content: string): string {
  if (!file.endsWith('.vue')) return content.trimStart()
  if (content.trimStart().startsWith('<!--')) return '/** HTML header */'
  return firstStatementOfScript(content)
}

describe('file headers', () => {
  const files = listSourceFiles(APP_ROOT)

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it.each(files.map((file) => [path.relative(APP_ROOT, file), file]))(
    '%s starts with a description comment',
    (_name, file) => {
      const source = headerSource(file as string, readFileSync(file as string, 'utf8'))
      expect(source).toMatch(/^\/\*\*|^<!--/)
    },
  )
})
