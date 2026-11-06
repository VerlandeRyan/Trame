import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COVER_SIZES } from './cover'

function listVueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listVueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

describe('largeurs de couverture', () => {
  it('ne propose que les cinq largeurs normalisées', () => {
    expect(COVER_SIZES).toEqual({ sm: 64, md: 72, lg: 96, xl: 112, hero: 210 })
  })

  it("aucun écran ne redéfinit la largeur d'une couverture avec :deep(.cover)", () => {
    const offenders = listVueFiles(resolve(process.cwd(), 'app')).filter((file) =>
      /:deep\(\.cover(--\w+)?\)\s*\{[^}]*width/.test(readFileSync(file, 'utf8')),
    )

    expect(offenders).toEqual([])
  })
})
