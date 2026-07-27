/** Curated faker paths safe to invoke from LLM / inference output. */

export const FAKER_PATH_WHITELIST = [
  'person.fullName',
  'person.firstName',
  'person.lastName',
  'internet.email',
  'internet.userName',
  'internet.url',
  'phone.number',
  'location.city',
  'location.country',
  'location.streetAddress',
  'location.zipCode',
  'company.name',
  'commerce.productName',
  'commerce.price',
  'finance.amount',
  'number.int',
  'number.float',
  'datatype.boolean',
  'string.uuid',
  'string.alphanumeric',
  'lorem.sentence',
  'lorem.word',
  'lorem.paragraph',
  'date.past',
  'date.recent',
  'date.soon',
  'helpers.arrayElement',
] as const

export type FakerPath = (typeof FAKER_PATH_WHITELIST)[number]

export type ColumnValueType = 'string' | 'number' | 'boolean' | 'date' | 'integer'

export interface SchemaColumn {
  name: string
  type: ColumnValueType
  fakerPath: FakerPath
  notes?: string
  /** Optional enum values for helpers.arrayElement */
  enumValues?: string[]
  /** Optional int range */
  min?: number
  max?: number
  /** When true (default), generated values are never null/empty */
  notNull?: boolean
  /** When true, values are unique across generated rows */
  unique?: boolean
}

export interface SchemaPlan {
  columns: SchemaColumn[]
  rows: Record<string, unknown>[]
  source: 'llm' | 'sample'
}

export function isFakerPath(value: string): value is FakerPath {
  return (FAKER_PATH_WHITELIST as readonly string[]).includes(value)
}

export function normalizeFakerPath(raw: string | undefined, fallback: FakerPath): FakerPath {
  if (!raw) return fallback
  const trimmed = raw.trim()
  if (isFakerPath(trimmed)) return trimmed
  // common aliases
  const aliases: Record<string, FakerPath> = {
    email: 'internet.email',
    name: 'person.fullName',
    fullName: 'person.fullName',
    firstName: 'person.firstName',
    lastName: 'person.lastName',
    phone: 'phone.number',
    city: 'location.city',
    country: 'location.country',
    uuid: 'string.uuid',
    id: 'string.uuid',
    boolean: 'datatype.boolean',
    bool: 'datatype.boolean',
    int: 'number.int',
    integer: 'number.int',
    float: 'number.float',
    date: 'date.past',
    datetime: 'date.past',
    price: 'commerce.price',
    company: 'company.name',
    url: 'internet.url',
    username: 'internet.userName',
  }
  return aliases[trimmed] ?? aliases[trimmed.toLowerCase()] ?? fallback
}
