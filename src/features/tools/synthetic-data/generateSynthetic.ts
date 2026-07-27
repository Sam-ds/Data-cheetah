import { faker } from '@faker-js/faker'
import type { FakerPath, SchemaColumn, SchemaPlan } from './schemaPlan'

function valueForColumn(col: SchemaColumn): unknown {
  const path = col.fakerPath as FakerPath
  switch (path) {
    case 'person.fullName':
      return faker.person.fullName()
    case 'person.firstName':
      return faker.person.firstName()
    case 'person.lastName':
      return faker.person.lastName()
    case 'internet.email':
      return faker.internet.email()
    case 'internet.userName':
      return faker.internet.username()
    case 'internet.url':
      return faker.internet.url()
    case 'phone.number':
      return faker.phone.number()
    case 'location.city':
      return faker.location.city()
    case 'location.country':
      return faker.location.country()
    case 'location.streetAddress':
      return faker.location.streetAddress()
    case 'location.zipCode':
      return faker.location.zipCode()
    case 'company.name':
      return faker.company.name()
    case 'commerce.productName':
      return faker.commerce.productName()
    case 'commerce.price':
      return Number(faker.commerce.price({ min: col.min ?? 1, max: col.max ?? 999 }))
    case 'finance.amount':
      return Number(faker.finance.amount({ min: col.min ?? 1, max: col.max ?? 9999, dec: 2 }))
    case 'number.int': {
      const min = Number.isFinite(col.min) ? Math.trunc(col.min!) : 1
      const max = Number.isFinite(col.max) ? Math.trunc(col.max!) : Math.max(min + 100, 1000)
      return faker.number.int({ min, max: max >= min ? max : min + 100 })
    }
    case 'number.float': {
      const min = Number.isFinite(col.min) ? col.min! : 0
      const max = Number.isFinite(col.max) ? col.max! : Math.max(min + 100, 100)
      return Number(faker.number.float({ min, max: max >= min ? max : min + 100, fractionDigits: 2 }))
    }
    case 'datatype.boolean':
      return faker.datatype.boolean()
    case 'string.uuid':
      return faker.string.uuid()
    case 'string.alphanumeric':
      return faker.string.alphanumeric({ length: 10 })
    case 'lorem.sentence':
      return faker.lorem.sentence()
    case 'lorem.word':
      return faker.lorem.word()
    case 'lorem.paragraph':
      return faker.lorem.paragraph()
    case 'date.past':
      return faker.date.past().toISOString().slice(0, 10)
    case 'date.recent':
      return faker.date.recent().toISOString().slice(0, 10)
    case 'date.soon':
      return faker.date.soon().toISOString().slice(0, 10)
    case 'helpers.arrayElement': {
      const opts = col.enumValues?.length ? col.enumValues : ['A', 'B', 'C']
      return faker.helpers.arrayElement(opts)
    }
    default:
      return faker.lorem.word()
  }
}

function normalizeSeedRow(
  row: Record<string, unknown>,
  columns: SchemaColumn[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const col of columns) {
    let v = row[col.name]
    if (v === undefined) {
      // try case-insensitive
      const key = Object.keys(row).find((k) => k.toLowerCase() === col.name.toLowerCase())
      v = key ? row[key] : undefined
    }
    if (v === undefined || v === null || v === '') {
      out[col.name] = valueForColumn(col)
      continue
    }
    if (col.type === 'integer' || col.type === 'number') {
      const n = Number(v)
      out[col.name] = Number.isNaN(n) ? valueForColumn(col) : n
    } else if (col.type === 'boolean') {
      if (typeof v === 'boolean') out[col.name] = v
      else out[col.name] = /^(true|1|yes)$/i.test(String(v))
    } else if (col.type === 'date') {
      const s = String(v)
      out[col.name] = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s
    } else {
      out[col.name] = v
    }
  }
  return out
}

export interface GenerateOptions {
  targetRows: number
  /** Optional RNG seed for reproducible faker output */
  seed?: number
}

export function generateSyntheticRows(plan: SchemaPlan, opts: GenerateOptions): Record<string, unknown>[] {
  const target = Math.max(1, Math.min(50_000, Math.floor(opts.targetRows)))
  if (opts.seed != null && Number.isFinite(opts.seed)) {
    faker.seed(opts.seed)
  }

  const seedRows = plan.rows.map((r) => normalizeSeedRow(r, plan.columns)).slice(0, target)
  const out = [...seedRows]

  while (out.length < target) {
    const row: Record<string, unknown> = {}
    for (const col of plan.columns) {
      row[col.name] = valueForColumn(col)
    }
    out.push(row)
  }

  return out
}
