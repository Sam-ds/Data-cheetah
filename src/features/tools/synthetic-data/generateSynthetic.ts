import { faker } from '@faker-js/faker'
import type { FakerPath, SchemaColumn, SchemaPlan } from './schemaPlan'

function valueForColumn(col: SchemaColumn, attempt = 0): unknown {
  const path = col.fakerPath as FakerPath
  switch (path) {
    case 'person.fullName':
      return attempt > 0 ? `${faker.person.fullName()} ${attempt}` : faker.person.fullName()
    case 'person.firstName':
      return attempt > 0 ? `${faker.person.firstName()}${attempt}` : faker.person.firstName()
    case 'person.lastName':
      return attempt > 0 ? `${faker.person.lastName()}${attempt}` : faker.person.lastName()
    case 'internet.email': {
      const email = faker.internet.email()
      if (attempt === 0) return email
      const at = email.indexOf('@')
      if (at > 0) return `${email.slice(0, at)}+${attempt}${email.slice(at)}`
      return `${email}.${attempt}`
    }
    case 'internet.userName':
      return attempt > 0 ? `${faker.internet.username()}${attempt}` : faker.internet.username()
    case 'internet.url':
      return attempt > 0 ? `${faker.internet.url()}/${attempt}` : faker.internet.url()
    case 'phone.number':
      return attempt > 0 ? `${faker.phone.number()}${attempt}` : faker.phone.number()
    case 'location.city':
      return attempt > 0 ? `${faker.location.city()} ${attempt}` : faker.location.city()
    case 'location.country':
      return attempt > 0 ? `${faker.location.country()} ${attempt}` : faker.location.country()
    case 'location.streetAddress':
      return attempt > 0
        ? `${faker.location.streetAddress()} #${attempt}`
        : faker.location.streetAddress()
    case 'location.zipCode':
      return attempt > 0 ? `${faker.location.zipCode()}-${attempt}` : faker.location.zipCode()
    case 'company.name':
      return attempt > 0 ? `${faker.company.name()} ${attempt}` : faker.company.name()
    case 'commerce.productName':
      return attempt > 0
        ? `${faker.commerce.productName()} ${attempt}`
        : faker.commerce.productName()
    case 'commerce.price':
      return Number(faker.commerce.price({ min: col.min ?? 1, max: col.max ?? 999 }))
    case 'finance.amount':
      return Number(faker.finance.amount({ min: col.min ?? 1, max: col.max ?? 9999, dec: 2 }))
    case 'number.int': {
      const min = Number.isFinite(col.min) ? Math.trunc(col.min!) : 1
      const max = Number.isFinite(col.max) ? Math.trunc(col.max!) : Math.max(min + 100_000, min + 1000)
      if (col.unique) {
        const start = Math.max(min, 1)
        return start + attempt
      }
      return faker.number.int({ min, max: max >= min ? max : min + 100 })
    }
    case 'number.float': {
      const min = Number.isFinite(col.min) ? col.min! : 0
      const max = Number.isFinite(col.max) ? col.max! : Math.max(min + 100, 100)
      const base = Number(
        faker.number.float({ min, max: max >= min ? max : min + 100, fractionDigits: 2 }),
      )
      return col.unique && attempt > 0 ? Number((base + attempt * 0.01).toFixed(2)) : base
    }
    case 'datatype.boolean':
      return faker.datatype.boolean()
    case 'string.uuid':
      return faker.string.uuid()
    case 'string.alphanumeric':
      return attempt > 0
        ? `${faker.string.alphanumeric({ length: 8 })}${attempt}`
        : faker.string.alphanumeric({ length: 10 })
    case 'lorem.sentence':
      return attempt > 0 ? `${faker.lorem.sentence()} (${attempt})` : faker.lorem.sentence()
    case 'lorem.word':
      return attempt > 0 ? `${faker.lorem.word()}${attempt}` : faker.lorem.word()
    case 'lorem.paragraph':
      return attempt > 0 ? `${faker.lorem.paragraph()} (${attempt})` : faker.lorem.paragraph()
    case 'date.past': {
      const d = faker.date.past()
      if (attempt > 0) d.setUTCDate(d.getUTCDate() + attempt)
      return d.toISOString().slice(0, 10)
    }
    case 'date.recent': {
      const d = faker.date.recent()
      if (attempt > 0) d.setUTCDate(d.getUTCDate() + attempt)
      return d.toISOString().slice(0, 10)
    }
    case 'date.soon': {
      const d = faker.date.soon()
      if (attempt > 0) d.setUTCDate(d.getUTCDate() + attempt)
      return d.toISOString().slice(0, 10)
    }
    case 'helpers.arrayElement': {
      const opts = col.enumValues?.length ? col.enumValues : ['A', 'B', 'C']
      if (col.unique) {
        if (attempt >= opts.length) {
          return `${opts[attempt % opts.length]}_${attempt}`
        }
        return opts[attempt]!
      }
      return faker.helpers.arrayElement(opts)
    }
    default:
      return attempt > 0 ? `${faker.lorem.word()}${attempt}` : faker.lorem.word()
  }
}

function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === ''
}

function valueKey(v: unknown): string {
  if (v == null) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function normalizeSeedRow(
  row: Record<string, unknown>,
  columns: SchemaColumn[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const col of columns) {
    let v = row[col.name]
    if (v === undefined) {
      const key = Object.keys(row).find((k) => k.toLowerCase() === col.name.toLowerCase())
      v = key ? row[key] : undefined
    }
    if (isEmptyValue(v)) {
      if (col.notNull === false) {
        out[col.name] = null
      } else {
        out[col.name] = valueForColumn(col)
      }
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

function uniqueValueForColumn(
  col: SchemaColumn,
  seen: Set<string>,
  sequentialStarts: Map<string, number>,
): unknown {
  const maxAttempts = Math.max(50, seen.size + 20)

  if (col.fakerPath === 'number.int' && col.unique) {
    const key = col.name
    let next = sequentialStarts.get(key)
    if (next == null) {
      const min = Number.isFinite(col.min) ? Math.trunc(col.min!) : 1
      next = min
      for (const existing of seen) {
        const n = Number(existing)
        if (!Number.isNaN(n)) next = Math.max(next, Math.trunc(n) + 1)
      }
    }
    while (seen.has(String(next))) next += 1
    sequentialStarts.set(key, next + 1)
    return next
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const value = valueForColumn(col, attempt)
    if (isEmptyValue(value) && col.notNull !== false) continue
    const key = valueKey(value)
    if (!seen.has(key)) return value
  }

  // Last resort: force uniqueness
  const fallback = `${valueForColumn(col, 0)}-${faker.string.alphanumeric({ length: 6 })}`
  return fallback
}

function fillColumnValue(
  col: SchemaColumn,
  seen: Map<string, Set<string>>,
  sequentialStarts: Map<string, number>,
): unknown {
  const requireNotNull = col.notNull !== false
  const requireUnique = Boolean(col.unique)

  if (!requireNotNull && !requireUnique && faker.number.int({ min: 1, max: 10 }) === 1) {
    return null
  }

  if (requireUnique) {
    const set = seen.get(col.name) ?? new Set<string>()
    seen.set(col.name, set)
    const value = uniqueValueForColumn(col, set, sequentialStarts)
    if (requireNotNull && isEmptyValue(value)) {
      const retry = uniqueValueForColumn(col, set, sequentialStarts)
      set.add(valueKey(retry))
      return retry
    }
    set.add(valueKey(value))
    return value
  }

  let value = valueForColumn(col)
  if (requireNotNull && isEmptyValue(value)) {
    value = valueForColumn(col, 1)
  }
  return value
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

  const seen = new Map<string, Set<string>>()
  const sequentialStarts = new Map<string, number>()
  for (const col of plan.columns) {
    if (col.unique) seen.set(col.name, new Set())
  }

  const seedRows = plan.rows.map((r) => normalizeSeedRow(r, plan.columns)).slice(0, target)
  const out: Record<string, unknown>[] = []

  for (const row of seedRows) {
    const fixed: Record<string, unknown> = { ...row }
    for (const col of plan.columns) {
      let v = fixed[col.name]
      if (col.notNull !== false && isEmptyValue(v)) {
        v = fillColumnValue(col, seen, sequentialStarts)
        fixed[col.name] = v
        continue
      }
      if (col.unique) {
        const set = seen.get(col.name) ?? new Set<string>()
        seen.set(col.name, set)
        const key = valueKey(v)
        if (set.has(key) || isEmptyValue(v)) {
          v = uniqueValueForColumn(col, set, sequentialStarts)
          fixed[col.name] = v
        }
        set.add(valueKey(fixed[col.name]))
      }
    }
    out.push(fixed)
  }

  while (out.length < target) {
    const row: Record<string, unknown> = {}
    for (const col of plan.columns) {
      row[col.name] = fillColumnValue(col, seen, sequentialStarts)
    }
    out.push(row)
  }

  return out
}
