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

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const send = (status, body) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }

  if (url.pathname === '/health') return send(200, { status: 'ok' })
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
