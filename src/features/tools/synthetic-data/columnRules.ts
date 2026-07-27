import Papa from 'papaparse'
import {
  type ColumnValueType,
  type SchemaColumn,
  type SchemaPlan,
} from './schemaPlan'

export interface ColumnRule {
  name: string
  notNull?: boolean
  unique?: boolean
  type?: ColumnValueType
}

function parseBool(raw: unknown, fallback?: boolean): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return fallback
  if (typeof raw === 'boolean') return raw
  const s = String(raw).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'not null', 'notnull', 'required'].includes(s)) return true
  if (['0', 'false', 'no', 'n', 'nullable', 'null', 'optional'].includes(s)) return false
  return fallback
}

function parseType(raw: unknown): ColumnValueType | undefined {
  if (raw == null || raw === '') return undefined
  const s = String(raw).trim().toLowerCase()
  if (s === 'integer' || s === 'int') return 'integer'
  if (s === 'number' || s === 'float' || s === 'double') return 'number'
  if (s === 'boolean' || s === 'bool') return 'boolean'
  if (s === 'date' || s === 'datetime') return 'date'
  if (s === 'string' || s === 'text') return 'string'
  return undefined
}

function defaultFakerForType(type: ColumnValueType): SchemaColumn['fakerPath'] {
  switch (type) {
    case 'integer':
      return 'number.int'
    case 'number':
      return 'number.float'
    case 'boolean':
      return 'datatype.boolean'
    case 'date':
      return 'date.past'
    default:
      return 'lorem.word'
  }
}

function guessTypeFromName(name: string): ColumnValueType {
  const lower = name.toLowerCase()
  if (/email|name|city|country|phone|url|address|company|product/i.test(lower)) return 'string'
  if (/^(is_|has_|active|enabled|flag)/i.test(lower)) return 'boolean'
  if (/date|time|_at$|_on$/i.test(lower)) return 'date'
  if (/id$|^id$|count|qty|quantity|amount|price|total/i.test(lower)) return 'integer'
  return 'string'
}

function ruleFromObject(row: Record<string, unknown>): ColumnRule | null {
  const name = String(row.name ?? row.column ?? row.field ?? '').trim()
  if (!name) return null

  let notNull = parseBool(row.notNull ?? row.not_null ?? row.required, undefined)
  if (notNull === undefined && row.nullable != null) {
    const nullable = parseBool(row.nullable, undefined)
    if (nullable !== undefined) notNull = !nullable
  }

  return {
    name,
    notNull,
    unique: parseBool(row.unique ?? row.isUnique ?? row.is_unique, undefined),
    type: parseType(row.type),
  }
}

/** Parse optional column rules (JSON, CSV, or `col: unique, not null` lines). */
export function parseColumnRules(text: string): ColumnRule[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as unknown
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { columns?: unknown }).columns)
        ? ((parsed as { columns: unknown[] }).columns)
        : null
    if (!list) throw new Error('Column rules JSON must be an array (or { "columns": [...] })')
    return list
      .map((item) => (item && typeof item === 'object' ? ruleFromObject(item as Record<string, unknown>) : null))
      .filter((r): r is ColumnRule => r != null)
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const looksLikeKv = lines.some((l) => l.includes(':')) && lines.every((l) => !l.includes(',') || l.includes(':'))
  if (looksLikeKv) {
    const rules: ColumnRule[] = []
    for (const line of lines) {
      const colon = line.indexOf(':')
      const name = (colon >= 0 ? line.slice(0, colon) : line).trim()
      if (!name) continue
      const text = (colon >= 0 ? line.slice(colon + 1) : '').toLowerCase()
      const rule: ColumnRule = { name }
      if (/\bunique\b/.test(text)) rule.unique = true
      if (/\bnot\s*null\b|\brequired\b/.test(text)) rule.notNull = true
      if (/\bnullable\b|\boptional\b/.test(text) && !/\bnot\s*null\b/.test(text)) {
        rule.notNull = false
      }
      rules.push(rule)
    }
    return rules
  }

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  if (parsed.errors.length && (!parsed.data || parsed.data.length === 0)) {
    throw new Error(parsed.errors[0]?.message || 'Could not parse column rules')
  }

  return (parsed.data || [])
    .filter((r) => r && Object.keys(r).length > 0)
    .map((row) => {
      const keys = Object.keys(row)
      const nameKey = keys.find((k) => /^(name|column|field|col)$/i.test(k)) ?? keys[0]
      if (!nameKey) return null
      const mapped: Record<string, unknown> = { ...row, name: row[nameKey] }
      const notNullKey = keys.find((k) => /not[_\s]?null|required|nullable/i.test(k))
      const uniqueKey = keys.find((k) => /unique/i.test(k))
      const typeKey = keys.find((k) => /^type$/i.test(k))
      if (notNullKey) mapped.not_null = row[notNullKey]
      if (notNullKey && /nullable/i.test(notNullKey)) {
        mapped.nullable = row[notNullKey]
        delete mapped.not_null
      }
      if (uniqueKey) mapped.unique = row[uniqueKey]
      if (typeKey) mapped.type = row[typeKey]
      return ruleFromObject(mapped)
    })
    .filter((r): r is ColumnRule => r != null)
}

/** Merge optional rules onto an inferred/LLM plan (match by column name). */
export function applyColumnRules(plan: SchemaPlan, rules: ColumnRule[]): SchemaPlan {
  if (rules.length === 0) return plan
  const byName = new Map(rules.map((r) => [r.name.toLowerCase(), r]))
  const used = new Set<string>()

  const columns = plan.columns.map((col) => {
    const rule = byName.get(col.name.toLowerCase())
    if (!rule) {
      return {
        ...col,
        notNull: col.notNull ?? true,
        unique: col.unique ?? false,
      }
    }
    used.add(col.name.toLowerCase())
    const type = rule.type ?? col.type
    return {
      ...col,
      type,
      fakerPath: rule.type && rule.type !== col.type ? defaultFakerForType(rule.type) : col.fakerPath,
      notNull: rule.notNull ?? col.notNull ?? true,
      unique: rule.unique ?? col.unique ?? false,
    } satisfies SchemaColumn
  })

  for (const rule of rules) {
    if (used.has(rule.name.toLowerCase())) continue
    if (columns.some((c) => c.name.toLowerCase() === rule.name.toLowerCase())) continue
    const type = rule.type ?? guessTypeFromName(rule.name)
    columns.push({
      name: rule.name,
      type,
      fakerPath: defaultFakerForType(type),
      notNull: rule.notNull ?? true,
      unique: rule.unique ?? false,
    })
  }

  return { ...plan, columns }
}

/** Build a plan from rules alone when no sample rows are provided. */
export function planFromColumnRules(rules: ColumnRule[]): SchemaPlan {
  if (rules.length === 0) {
    throw new Error('Provide a sample and/or column rules')
  }
  const columns: SchemaColumn[] = rules.map((rule) => {
    const type = rule.type ?? guessTypeFromName(rule.name)
    return {
      name: rule.name,
      type,
      fakerPath: defaultFakerForType(type),
      notNull: rule.notNull ?? true,
      unique: rule.unique ?? false,
    }
  })
  return { columns, rows: [], source: 'sample' }
}

export function formatColumnConstraints(col: SchemaColumn): string {
  const bits: string[] = []
  if (col.unique) bits.push('unique')
  if (col.notNull === false) bits.push('nullable')
  else bits.push('not null')
  return `${col.name}(${bits.join(', ')})`
}
