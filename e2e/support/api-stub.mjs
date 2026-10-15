// Doublure minimale de l'API pour les parcours E2E du front : réponses fixes, données fictives,
// aucune base nécessaire. Le contrat réel est testé côté `api/` (tests/works.test.ts).
import { createServer } from 'node:http'

const port = Number(process.env.STUB_API_PORT ?? 3202)

const work = {
  id: 42,
  title: 'Les Lanternes de Brume',
  originalTitle: 'Les Lanternes de Brume',
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  synopsis: 'Une cartographe suit une faille qui dévore les routes.',
  synopsisLanguage: 'fr',
  synopsisSource: 'official',
  chapters: null,
  volumes: null,
  startedOn: '2021-01-15',
  endedOn: null,
  coverPath: null,
  alternativeTitles: [{ language: 'en', kind: 'translated', title: 'The Mist Lanterns' }],
  credits: [
    {
      personId: 1,
      name: 'Autrice Inventée',
      kind: 'person',
      roles: ['story', 'art'],
      links: [{ kind: 'social', url: 'https://reseau.exemple.test/autrice', label: null }],
    },
  ],
  publishers: [{ id: 1, name: 'Éditions Fictives', kind: 'publisher', url: null }],
  formats: ['manga'],
  genres: ['fantasy'],
  links: [
    { kind: 'read', url: 'https://lire.exemple.test/lanternes', label: null },
    { kind: 'buy', url: 'https://acheter.exemple.test/lanternes', label: null },
  ],
  relations: [
    { relation: 'sequel', direction: 'incoming', work: { id: 43, title: 'Après la Brume', type: 'series' } },
  ],
  memberCount: 2,
  ratingCount: 1,
  ratingAverage: null,
}

const localizedTitles = { en: 'The Mist Lanterns' }

const summaries = [
  {
    id: 42,
    title: 'Les Lanternes de Brume',
    originalTitle: 'Les Lanternes de Brume',
    originalLanguage: 'fr',
    type: 'series',
    status: 'ongoing',
    formats: ['manga'],
    coverPath: null,
    mainAuthor: 'Autrice Inventée',
  },
  {
    id: 43,
    title: 'Après la Brume',
    originalTitle: 'Après la Brume',
    originalLanguage: 'fr',
    type: 'oneshot',
    status: 'completed',
    formats: ['webtoon'],
    coverPath: null,
    mainAuthor: null,
  },
]

const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()

function matching(params, omitted) {
  const q = normalize(params.get('q') ?? '')
  return summaries.filter(
    (work) =>
      normalize(work.title).includes(q) &&
      (omitted === 'type' ||
        !params.get('type') ||
        params.get('type').split(',').includes(work.type)),
  )
}

function searchResults(params) {
  const items = matching(params)
  const sort = params.get('sort')
  if (sort === 'title') items.sort((a, b) => normalize(a.title).localeCompare(normalize(b.title)))
  if (sort === 'recent') items.sort((a, b) => b.id - a.id)
  return { items, page: 1, pageSize: 20, total: items.length, approximate: false }
}

function countBy(works, pick) {
  const counts = new Map()
  for (const value of works.flatMap(pick)) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].map(([code, count]) => ({ code, count }))
}

function searchFacets(params) {
  const filtered = matching(params)
  return {
    type: countBy(matching(params, 'type'), (work) => [work.type]),
    status: countBy(filtered, (work) => [work.status]),
    format: countBy(filtered, (work) => work.formats),
    genre: [],
    originalLanguage: countBy(filtered, (work) => [work.originalLanguage]),
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const send = (status, body) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }

  if (url.pathname === '/health') return send(200, { status: 'ok' })
  if (url.pathname === '/api/v1/works') return send(200, searchResults(url.searchParams))
  if (url.pathname === '/api/v1/works/facets') return send(200, searchFacets(url.searchParams))
  // Cinq auteurs : repli « + 2 autres auteurs ».
  if (url.pathname === '/api/v1/works/44') {
    const names = ['Auteur Inventé A', 'Auteur Inventé B', 'Auteur Inventé C', 'Auteur Inventé D', 'Auteur Inventé E']
    return send(200, {
      ...work,
      id: 44,
      title: 'Cinq Mains',
      originalTitle: 'Cinq Mains',
      alternativeTitles: [],
      relations: [],
      credits: names.map((name, index) => ({
        personId: 100 + index,
        name,
        kind: 'person',
        roles: ['story'],
        links: [],
      })),
    })
  }
  if (url.pathname === '/api/v1/works/43') {
    return send(200, {
      ...work,
      id: 43,
      title: 'Après la Brume',
      originalTitle: 'Après la Brume',
      alternativeTitles: [],
      relations: [
        { relation: 'sequel', direction: 'outgoing', work: { id: 42, title: work.title, type: 'series' } },
      ],
    })
  }
  if (url.pathname === '/api/v1/works/42') {
    const lang = url.searchParams.get('lang')
    const title = localizedTitles[lang] ?? work.title
    return send(200, { ...work, title })
  }
  return send(404, { code: 'NOT_FOUND', message: 'Work not found' })
})

server.listen(port, '127.0.0.1')
