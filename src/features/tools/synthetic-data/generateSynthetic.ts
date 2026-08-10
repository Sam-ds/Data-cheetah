import { faker } from '@faker-js/faker'
import type { FakerPath, SchemaColumn, SchemaPlan } from './schemaPlan'

const DEFAULT_EMAIL_PROVIDERS = [
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'proton.me',
  'icloud.com',
] as const

export interface GenerateValueOptions {
  /** Domains for internet.email (e.g. gmail.com). Empty/invalid falls back to defaults. */
  emailProviders?: string[]
}

/** Parse a user field like "gmail.com, outlook.com" into clean domain list. */
export function parseEmailProviders(input: string | undefined | null): string[] {
  if (!input?.trim()) return [...DEFAULT_EMAIL_PROVIDERS]
  const domains = input
    .split(/[,;\s]+/)
    .map((part) => part.trim().toLowerCase().replace(/^@/, ''))
    .map((part) => (part.includes('@') ? part.slice(part.lastIndexOf('@') + 1) : part))
    .filter((part) =>
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(part),
    )
  return domains.length > 0 ? [...new Set(domains)] : [...DEFAULT_EMAIL_PROVIDERS]
}

function formatYmdUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateBetweenBounds(col: SchemaColumn, attempt = 0): string {
  const now = Date.now()
  const defaultMin = now - 365 * 86400000 * 5
  const defaultMax = now
  let minMs = Number.isFinite(col.min) ? col.min! : defaultMin
  let maxMs = Number.isFinite(col.max) ? col.max! : defaultMax
  if (minMs > maxMs) {
    const t = minMs
    minMs = maxMs
    maxMs = t
  }
  // Keep unique retries inside the window when possible
  const span = Math.max(0, maxMs - minMs)
  const dayMs = 86400000
  if (col.unique && span >= dayMs) {
    const days = Math.floor(span / dayMs) + 1
    const offset = attempt % days
    return formatYmdUtc(new Date(minMs + offset * dayMs))
  }
  const t = minMs + faker.number.float({ min: 0, max: Math.max(span, 0) })
  const d = new Date(t)
  if (attempt > 0) d.setUTCDate(d.getUTCDate() + attempt)
  if (d.getTime() > maxMs) return formatYmdUtc(new Date(maxMs))
  if (d.getTime() < minMs) return formatYmdUtc(new Date(minMs))
  return formatYmdUtc(d)
}

function valueForColumn(col: SchemaColumn, attempt = 0, opts?: GenerateValueOptions): unknown {
  const path = col.fakerPath as FakerPath
  switch (path) {
    case 'person.fullName':
      return attempt > 0 ? `${faker.person.fullName()} ${attempt}` : faker.person.fullName()
    case 'person.firstName':
      return attempt > 0 ? `${faker.person.firstName()}${attempt}` : faker.person.firstName()
    case 'person.lastName':
      return attempt > 0 ? `${faker.person.lastName()}${attempt}` : faker.person.lastName()
    case 'internet.email': {
      const providers =
        opts?.emailProviders && opts.emailProviders.length > 0
          ? opts.emailProviders
          : [...DEFAULT_EMAIL_PROVIDERS]
      const local = faker.internet
        .username()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
      const provider = providers[attempt % providers.length] ?? providers[0]!
      const email = `${local || 'user'}@${provider}`
      if (attempt === 0) return email
      const at = email.indexOf('@')
      return `${email.slice(0, at)}+${attempt}${email.slice(at)}`
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
    case 'commerce.price': {
      const min = Number.isFinite(col.min) ? col.min! : 1
      const max = Number.isFinite(col.max) ? col.max! : 999
      return Number(faker.commerce.price({ min, max: max >= min ? max : min + 1 }))
    }
    case 'finance.amount': {
      const min = Number.isFinite(col.min) ? col.min! : 1
      const max = Number.isFinite(col.max) ? col.max! : 9999
      return Number(
        faker.finance.amount({ min, max: max >= min ? max : min + 1, dec: 2 }),
      )
    }
    case 'number.int': {
      const min = Number.isFinite(col.min) ? Math.trunc(col.min!) : 1
      const max = Number.isFinite(col.max)
        ? Math.trunc(col.max!)
        : Math.max(min + 100_000, min + 1000)
      if (col.unique) {
        const start = min
        const value = start + attempt
        return max >= min ? Math.min(value, max) : value
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
    case 'date.past':
    case 'date.recent':
    case 'date.soon':
      if (col.min != null || col.max != null || col.type === 'date') {
        return dateBetweenBounds(col, attempt)
      }
      {
        const d =
          path === 'date.recent'
            ? faker.date.recent()
            : path === 'date.soon'
              ? faker.date.soon()
              : faker.date.past()
        if (attempt > 0) d.setUTCDate(d.getUTCDate() + attempt)
        return formatYmdUtc(d)
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
  opts?: GenerateValueOptions,
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
        out[col.name] = valueForColumn(col, 0, opts)
      }
      continue
    }
    if (col.type === 'integer' || col.type === 'number') {
      const n = Number(v)
      out[col.name] = Number.isNaN(n) ? valueForColumn(col, 0, opts) : n
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
  opts?: GenerateValueOptions,
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
    const value = valueForColumn(col, attempt, opts)
    if (isEmptyValue(value) && col.notNull !== false) continue
    const key = valueKey(value)
    if (!seen.has(key)) return value
  }

  // Last resort: force uniqueness
  const fallback = `${valueForColumn(col, 0, opts)}-${faker.string.alphanumeric({ length: 6 })}`
  return fallback
}

function fillColumnValue(
  col: SchemaColumn,
  seen: Map<string, Set<string>>,
  sequentialStarts: Map<string, number>,
  opts?: GenerateValueOptions,
): unknown {
  const requireNotNull = col.notNull !== false
  const requireUnique = Boolean(col.unique)

  if (!requireNotNull && !requireUnique && faker.number.int({ min: 1, max: 10 }) === 1) {
    return null
  }

  if (requireUnique) {
    const set = seen.get(col.name) ?? new Set<string>()
    seen.set(col.name, set)
    const value = uniqueValueForColumn(col, set, sequentialStarts, opts)
    if (requireNotNull && isEmptyValue(value)) {
      const retry = uniqueValueForColumn(col, set, sequentialStarts, opts)
      set.add(valueKey(retry))
      return retry
    }
    set.add(valueKey(value))
    return value
  }

  let value = valueForColumn(col, 0, opts)
  if (requireNotNull && isEmptyValue(value)) {
    value = valueForColumn(col, 1, opts)
  }
  return value
}

export interface GenerateOptions extends GenerateValueOptions {
  targetRows: number
  /** Optional RNG seed for reproducible faker output */
  seed?: number
}

/**
 * Generate one row without retaining cross-row state. Used by large streamed
 * exports where keeping millions of rows or uniqueness Sets would exhaust RAM.
 */
export function generateSyntheticRow(
  plan: SchemaPlan,
  rowIndex: number,
  opts?: GenerateValueOptions,
): Record<string, unknown> {
  const seed = plan.rows[rowIndex]
  if (seed) return normalizeSeedRow(seed, plan.columns, opts)

  const row: Record<string, unknown> = {}
  for (const col of plan.columns) {
    if (col.notNull === false && !col.unique && faker.number.int({ min: 1, max: 10 }) === 1) {
      row[col.name] = null
    } else {
      row[col.name] = valueForColumn(col, col.unique ? rowIndex : 0, opts)
    }
  }
  return row
}

export function generateSyntheticRows(plan: SchemaPlan, opts: GenerateOptions): Record<string, unknown>[] {
  const target = Math.max(1, Math.min(50_000, Math.floor(opts.targetRows)))
  if (opts.seed != null && Number.isFinite(opts.seed)) {
    faker.seed(opts.seed)
  }
  const valueOpts: GenerateValueOptions = { emailProviders: opts.emailProviders }

  const seen = new Map<string, Set<string>>()
  const sequentialStarts = new Map<string, number>()
  for (const col of plan.columns) {
    if (col.unique) seen.set(col.name, new Set())
  }

  const seedRows = plan.rows.map((r) => normalizeSeedRow(r, plan.columns, valueOpts)).slice(0, target)
  const out: Record<string, unknown>[] = []

  for (const row of seedRows) {
    const fixed: Record<string, unknown> = { ...row }
    for (const col of plan.columns) {
      let v = fixed[col.name]
      if (col.notNull !== false && isEmptyValue(v)) {
        v = fillColumnValue(col, seen, sequentialStarts, valueOpts)
        fixed[col.name] = v
        continue
      }
      if (col.unique) {
        const set = seen.get(col.name) ?? new Set<string>()
        seen.set(col.name, set)
        const key = valueKey(v)
        if (set.has(key) || isEmptyValue(v)) {
          v = uniqueValueForColumn(col, set, sequentialStarts, valueOpts)
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
      row[col.name] = fillColumnValue(col, seen, sequentialStarts, valueOpts)
    }
    out.push(row)
  }

  return out
}
