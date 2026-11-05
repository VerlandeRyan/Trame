import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'

// Vitest s'exécute depuis `web/` ; `import.meta.url` n'est pas un fichier dans l'environnement Nuxt.
const tokens = readFileSync(resolve(process.cwd(), 'app/assets/styles/_tokens.scss'), 'utf8')

/** Valeur `#rrggbb` d'un jeton de `_tokens.scss`. */
function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens)
  if (!match) throw new Error(`Jeton --${name} introuvable`)
  return match[1]!
}

describe('contrastRatio', () => {
  it('vaut 21 entre noir et blanc, 1 entre deux couleurs identiques', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })

  it("ne dépend pas de l'ordre des couleurs", () => {
    expect(contrastRatio('#1b2a5c', '#f07a9c')).toBe(contrastRatio('#f07a9c', '#1b2a5c'))
  })
})

// Boutons colorés : au survol et à l'appui seul le fond s'assombrit (10 % de noir), le texte reste.
// Exception assumée (#164) : « Terminé » et « Abandonné » passent sous 4,5:1 le temps du survol.
describe('boutons colorés au survol', () => {
  const ink = token('color-ink')

  it.each([
    ['reading', 4.5],
    ['completed', 4.4],
    ['plan_to_read', 4.5],
    ['on_hold', 4.5],
    ['dropped', 3.5],
  ])(
    'texte d’encre lisible sur le fond de survol du statut %s, plus foncé que son repos',
    (status, minimumRatio) => {
      const strong = token(`status-${status}-strong`)
      expect(contrastRatio(ink, strong)).toBeGreaterThanOrEqual(minimumRatio)
      expect(strong).not.toBe(token(`status-${status}`))
    },
  )

  it('texte blanc lisible sur le rouge de confirmation, au repos et au survol', () => {
    expect(contrastRatio('#ffffff', token('color-danger'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', token('color-danger-strong'))).toBeGreaterThanOrEqual(
      contrastRatio('#ffffff', token('color-danger')),
    )
  })

  it('rouge de « Archiver » lisible au survol sur le rose pâle', () => {
    expect(contrastRatio(token('color-danger'), token('color-chip'))).toBeGreaterThanOrEqual(4.5)
  })

  it('trait des onglets soulignés visible sur le papier (3:1, élément graphique)', () => {
    expect(contrastRatio(token('color-blue-line'), token('color-paper'))).toBeGreaterThanOrEqual(3)
  })
})

// Texte courant sur les fonds de survol : au moins le seuil AA (4,5:1). Si un rose devient trop
// foncé pour le texte d'encre, ce test le dit avant l'œil.
describe('couleurs de survol', () => {
  const ink = token('color-ink')

  it.each([
    ['color-rose', 'repos des boutons principaux et survol des formats'],
    ['color-rose-strong', 'survol des boutons principaux'],
    ['color-rose-soft', 'survol des genres'],
    ['color-cover-empty', 'survol des boutons blancs et de « Tous les… »'],
    ['color-field-soft', 'repos de « Tous les… »'],
    ['color-chip', 'repos des genres'],
    ['color-format-manga', 'carte du menu Explorer'],
    ['color-format-manhwa', 'carte du menu Explorer'],
    ['color-format-webtoon', 'carte du menu Explorer'],
    ['color-format-bd', 'carte du menu Explorer'],
    ['color-format-webcomic', 'carte du menu Explorer'],
  ])('texte d’encre lisible sur %s (%s)', (name) => {
    expect(contrastRatio(ink, token(name))).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['color-yellow', 'badge « Populaire cette semaine » et compteurs'],
    ['color-cyan', 'surlignage des mots clés du sous-titre'],
    ['status-reading', 'icône « Garde le fil » du panneau « Pourquoi Trame ? »'],
    ['status-plan_to_read', 'icône « Une seule appli » du panneau'],
  ])('texte d’encre lisible sur %s (%s)', (name) => {
    expect(contrastRatio(ink, token(name))).toBeGreaterThanOrEqual(4.5)
  })

  it('« N lecteurs l’ont ajoutée » lisible sur le blanc de la carte', () => {
    expect(contrastRatio(token('color-crimson'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('lien « Tout voir » lisible au survol sur le papier', () => {
    expect(contrastRatio(token('color-blue-light'), token('color-paper'))).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('texte blanc lisible sur le bleu et sur le bleu de survol', () => {
    expect(contrastRatio('#ffffff', token('color-blue'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', token('color-blue-strong'))).toBeGreaterThanOrEqual(4.5)
  })
})
