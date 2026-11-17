/**
 * Keeps the red stars of the forms aligned with the API: the fields the contract requires (and
 * does not allow to be null) are exactly those the forms mark. A new required field in the API
 * fails here until the form marks it and this list is updated.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { URL_MAX_LENGTH } from './admin'

type JsonSchema = {
  required?: string[]
  properties?: Record<string, JsonSchema>
  anyOf?: JsonSchema[]
  type?: string
  maxLength?: number
  items?: JsonSchema
}
type Contract = {
  paths: Record<
    string,
    Record<string, { requestBody?: { content: { 'application/json': { schema: JsonSchema } } } }>
  >
}

const contract = JSON.parse(
  readFileSync(resolve(process.cwd(), '../api/openapi.json'), 'utf8'),
) as Contract

/** Request body of a write route. */
const bodyOf = (path: string, method: string): JsonSchema =>
  contract.paths[path]![method]!.requestBody!.content['application/json'].schema

/** Whether the schema accepts null. */
const isNullable = (schema: JsonSchema) =>
  schema.anyOf?.some((part) => part.type === 'null') ?? false

/** Names of the properties that must be filled: required and not nullable. */
function mustBeFilled(schema: JsonSchema): string[] {
  return (schema.required ?? [])
    .filter((name) => !isNullable(schema.properties![name]!))
    .sort((a, b) => a.localeCompare(b))
}

describe('champs obligatoires des formulaires', () => {
  it('pseudo : le pseudo', () => {
    expect(mustBeFilled(bodyOf('/api/v1/auth/handle', 'post'))).toEqual(['handle'])
  })

  it('personne : nom et genre', () => {
    expect(mustBeFilled(bodyOf('/api/v1/admin/people', 'post'))).toEqual(['kind', 'name'])
  })

  it('éditeur : nom et genre', () => {
    expect(mustBeFilled(bodyOf('/api/v1/admin/publishers', 'post'))).toEqual(['kind', 'name'])
  })

  it('œuvre : titre, langue d’origine, type et statut', () => {
    expect(mustBeFilled(bodyOf('/api/v1/admin/works', 'post'))).toEqual([
      'originalLanguage',
      'status',
      'title',
      'type',
    ])
  })

  it('la longueur maximale d’une adresse suit celle de l’API', () => {
    const link = bodyOf('/api/v1/admin/works', 'post').properties!.links!.items!
    expect(link.properties!.url!.maxLength).toBe(URL_MAX_LENGTH)
  })

  it.each([
    ['titles', ['kind', 'language', 'title']],
    ['synopses', ['language', 'source', 'text']],
    ['credits', ['personId', 'role']],
    ['relations', ['relatedWorkId', 'relation']],
    ['links', ['kind', 'url']],
  ])('lignes de %s : %j', (list, expected) => {
    const item = bodyOf('/api/v1/admin/works', 'post').properties![list]!.items!
    expect(mustBeFilled(item)).toEqual(expected)
  })
})
