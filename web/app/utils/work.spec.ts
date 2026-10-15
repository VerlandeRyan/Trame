import { describe, expect, it } from 'vitest'
import {
  buildJsonLd,
  coverUrl,
  formatAlternativeTitles,
  formatTotal,
  groupRelations,
  isSafeLink,
  linkNetwork,
  metaDescription,
  parseWorkId,
  serializeJsonLd,
  slugify,
  workSlug,
  type WorkDetail,
  type WorkRelation,
} from './work'

const baseWork: WorkDetail = {
  id: 42,
  title: 'Aube Fictive',
  originalTitle: 'Aube Fictive',
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  synopsis: null,
  synopsisLanguage: null,
  synopsisSource: null,
  chapters: null,
  volumes: null,
  startedOn: null,
  endedOn: null,
  coverPath: null,
  alternativeTitles: [],
  credits: [],
  publishers: [],
  formats: [],
  genres: [],
  links: [],
  relations: [],
  memberCount: 0,
  ratingCount: 0,
  ratingAverage: null,
}

function relation(
  kind: WorkRelation['relation'],
  direction: WorkRelation['direction'],
  id: number,
): WorkRelation {
  return { relation: kind, direction, work: { id, title: `Œuvre ${id}`, type: 'series' } }
}

describe('slugify et workSlug', () => {
  it('retire les accents, la ponctuation et les majuscules', () => {
    expect(slugify('Les Lanternes de Brume !')).toBe('les-lanternes-de-brume')
    expect(slugify('Étoile Vagabonde – Crépuscule')).toBe('etoile-vagabonde-crepuscule')
  })

  it('borne la longueur sans finir sur un tiret', () => {
    const slug = slugify('mot '.repeat(40))
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug.endsWith('-')).toBe(false)
  })

  it("construit `{id}-{slug}`, ou l'identifiant seul sans caractère utile", () => {
    expect(workSlug(42, 'Aube Fictive')).toBe('42-aube-fictive')
    expect(workSlug(7, '???')).toBe('7')
  })
})

describe('parseWorkId', () => {
  it("lit l'identifiant et ignore le slug", () => {
    expect(parseWorkId('42-aube-fictive')).toBe(42)
    expect(parseWorkId('42-nimporte-quoi')).toBe(42)
    expect(parseWorkId('42')).toBe(42)
  })

  it('refuse ce qui ne commence pas par un entier positif', () => {
    for (const bad of [
      '',
      'aube-fictive',
      '0',
      '0-x',
      '-1',
      '4.2-x',
      '1e3',
      '42x',
      '12345678901234567890',
    ]) {
      expect(parseWorkId(bad), bad).toBeNull()
    }
  })
})

describe('formatTotal', () => {
  it('affiche « ? » tant que le total est inconnu', () => {
    expect(formatTotal(null)).toBe('?')
    expect(formatTotal(0)).toBe('0')
    expect(formatTotal(158)).toBe('158')
  })
})

describe('liens et couvertures', () => {
  it('accepte uniquement https', () => {
    expect(isSafeLink('https://exemple.test/a')).toBe(true)
    for (const bad of [
      'http://exemple.test',
      'javascript:alert(1)',
      'data:text/html,x',
      'https://a b',
    ]) {
      expect(isSafeLink(bad), bad).toBe(false)
    }
  })

  it('ne garde une couverture que pour une URL https ou un chemin du site', () => {
    expect(coverUrl(null)).toBeUndefined()
    expect(coverUrl('/covers/42.webp')).toBe('/covers/42.webp')
    expect(coverUrl('https://img.exemple.test/42.webp')).toBe('https://img.exemple.test/42.webp')
    expect(coverUrl('javascript:alert(1)')).toBeUndefined()
    expect(coverUrl('covers/42.webp')).toBeUndefined()
  })
})

describe('linkNetwork', () => {
  it('reconnaît le réseau par son domaine, sous-domaines compris', () => {
    expect(linkNetwork('https://x.com/auteur')).toBe('x')
    expect(linkNetwork('https://twitter.com/auteur')).toBe('x')
    expect(linkNetwork('https://www.instagram.com/auteur')).toBe('instagram')
    expect(linkNetwork('https://youtu.be/abc')).toBe('youtube')
    expect(linkNetwork('https://bsky.app/profile/auteur')).toBe('bluesky')
  })

  it('retombe sur « website » pour un site, un faux ami ou une adresse invalide', () => {
    expect(linkNetwork('https://auteur.exemple.test')).toBe('website')
    expect(linkNetwork('https://notx.com/a')).toBe('website')
    expect(linkNetwork('pas une url')).toBe('website')
  })
})

describe('groupRelations', () => {
  it("déduit l'inverse de la relation stockée et ordonne les groupes", () => {
    const groups = groupRelations([
      relation('shared_universe', 'incoming', 3),
      relation('spin_off', 'incoming', 2),
      relation('sequel', 'incoming', 1),
      relation('contains', 'incoming', 4),
      relation('prequel', 'outgoing', 5),
    ])
    expect(groups.map((g) => g.key)).toEqual(['sequel', 'spin_off', 'shared_universe', 'part_of'])
    expect(groups[0]?.works.map((w) => w.id)).toEqual([1, 5])
  })

  it('distingue le sens de chaque relation', () => {
    expect(groupRelations([relation('spin_off', 'outgoing', 1)])[0]?.key).toBe('spin_off_parent')
    expect(groupRelations([relation('adaptation', 'incoming', 1)])[0]?.key).toBe('adaptation')
    expect(groupRelations([relation('contains', 'outgoing', 1)])[0]?.key).toBe('contains')
    expect(groupRelations([relation('sequel', 'outgoing', 1)])[0]?.key).toBe('prequel')
  })

  it("n'affiche pas deux fois la même œuvre dans un groupe", () => {
    const groups = groupRelations([
      relation('shared_universe', 'incoming', 1),
      relation('shared_universe', 'outgoing', 1),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.works).toHaveLength(1)
  })

  it('renvoie une liste vide sans relation', () => {
    expect(groupRelations([])).toEqual([])
  })
})

describe('metaDescription', () => {
  it('reprend le synopsis tel quel quand il est court', () => {
    expect(metaDescription('Un récit\n  court.', 'repli')).toBe('Un récit court.')
  })

  it('coupe sur un mot et ajoute une ellipse quand il est long', () => {
    const text = 'mot '.repeat(80).trim()
    const description = metaDescription(text, 'repli', 50)
    expect(description.length).toBeLessThanOrEqual(50)
    expect(description.endsWith('…')).toBe(true)
  })

  it('utilise le repli sans synopsis', () => {
    expect(metaDescription(null, 'repli')).toBe('repli')
    expect(metaDescription('   ', 'repli')).toBe('repli')
  })
})

describe('serializeJsonLd', () => {
  it('échappe `<` pour qu’un titre ne referme pas la balise script', () => {
    const output = serializeJsonLd({ name: '</script><script>alert(1)</script>' })
    expect(output).not.toContain('<')
    expect(JSON.parse(output)).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})

describe('formatAlternativeTitles', () => {
  it('préfixe chaque titre de sa langue et retire les doublons', () => {
    expect(
      formatAlternativeTitles([
        { language: 'en', kind: 'translated', title: 'Work Title' },
        { language: 'en', kind: 'international', title: 'Work Title' },
        { language: 'de', kind: 'translated', title: 'Werktitel' },
      ]),
    ).toBe('EN : Work Title · DE : Werktitel')
    expect(formatAlternativeTitles([])).toBe('')
  })
})

describe('buildJsonLd', () => {
  it('décrit une série minimale', () => {
    expect(buildJsonLd(baseWork, 'https://trame.test/work/42-aube-fictive', '')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ComicSeries',
      name: 'Aube Fictive',
      url: 'https://trame.test/work/42-aube-fictive',
      inLanguage: 'fr',
    })
  })

  it('complète auteurs, éditeurs, genres, liens https et note', () => {
    const json = buildJsonLd(
      {
        ...baseWork,
        type: 'oneshot',
        startedOn: '2024-01-02',
        credits: [
          { personId: 1, name: 'Léa', kind: 'person', roles: ['story'], links: [] },
          { personId: 2, name: 'Atelier', kind: 'collective', roles: ['art'], links: [] },
        ],
        publishers: [{ id: 1, name: 'Éditions Fictives', kind: 'publisher', url: null }],
        formats: ['manga'],
        genres: ['fantasy'],
        links: [
          { kind: 'read', url: 'https://lire.test/42', label: null },
          { kind: 'buy', url: 'javascript:alert(1)', label: null },
        ],
        ratingCount: 12,
        ratingAverage: 7.5,
      },
      'https://trame.test/work/42-aube-fictive',
      'Un récit.',
    )
    expect(json).toMatchObject({
      '@type': 'CreativeWork',
      description: 'Un récit.',
      creator: [
        { '@type': 'Person', name: 'Léa' },
        { '@type': 'Organization', name: 'Atelier' },
      ],
      publisher: [{ '@type': 'Organization', name: 'Éditions Fictives' }],
      genre: ['manga', 'fantasy'],
      datePublished: '2024-01-02',
      sameAs: ['https://lire.test/42'],
      aggregateRating: { ratingValue: 7.5, ratingCount: 12 },
    })
  })
})
