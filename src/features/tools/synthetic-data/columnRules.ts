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
  /** Inclusive lower bound (numbers, or UTC epoch ms for dates) */
  min?: number
  /** Inclusive upper bound (numbers, or UTC epoch ms for dates) */
  max?: number
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

/** Parse number or YYYY-MM-DD into a numeric bound (epoch ms for dates). */
export function parseBound(raw: unknown, asDate = false): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw).trim()
  if (!s) return undefined

  const dateMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch || asDate) {
    const iso = dateMatch ? s : s.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const t = Date.parse(`${iso}T00:00:00.000Z`)
      if (!Number.isNaN(t)) return t
    }
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
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

function normalizeMinMax(min?: number, max?: number): { min?: number; max?: number } {
  if (min == null && max == null) return {}
  if (min != null && max != null && min > max) return { min: max, max: min }
  return { min, max }
}

function ruleFromObject(row: Record<string, unknown>): ColumnRule | null {
  const name = String(row.name ?? row.column ?? row.field ?? '').trim()
  if (!name) return null

  let notNull = parseBool(row.notNull ?? row.not_null ?? row.required, undefined)
  if (notNull === undefined && row.nullable != null) {
    const nullable = parseBool(row.nullable, undefined)
    if (nullable !== undefined) notNull = !nullable
  }

  const type = parseType(row.type)
  const asDate = type === 'date'
  const { min, max } = normalizeMinMax(
    parseBound(row.min ?? row.from, asDate),
    parseBound(row.max ?? row.to, asDate),
  )

  return {
    name,
    notNull,
    unique: parseBool(row.unique ?? row.isUnique ?? row.is_unique, undefined),
    type,
    min,
    max,
  }
}

function parseLineRule(line: string): ColumnRule | null {
  const colon = line.indexOf(':')
  const name = (colon >= 0 ? line.slice(0, colon) : line).trim()
  if (!name) return null
  const rest = colon >= 0 ? line.slice(colon + 1) : ''
  const lower = rest.toLowerCase()

  const rule: ColumnRule = { name }
  if (/\bunique\b/.test(lower)) rule.unique = true
  if (/\bnot\s*null\b|\brequired\b/.test(lower)) rule.notNull = true
  if (/\bnullable\b|\boptional\b/.test(lower) && !/\bnot\s*null\b/.test(lower)) {
    rule.notNull = false
  }

  const typeMatch = lower.match(/\b(integer|int|number|float|double|boolean|bool|date|datetime|string|text)\b/)
  if (typeMatch) rule.type = parseType(typeMatch[1])

  const asDate = rule.type === 'date'
  const fromMatch =
    rest.match(/\bfrom\s*[:=]?\s*([^\s,]+)/i) ?? rest.match(/\bmin\s*[:=]?\s*([^\s,]+)/i)
  const toMatch =
    rest.match(/\bto\s*[:=]?\s*([^\s,]+)/i) ?? rest.match(/\bmax\s*[:=]?\s*([^\s,]+)/i)

  const { min, max } = normalizeMinMax(
    fromMatch ? parseBound(fromMatch[1], asDate) : undefined,
    toMatch ? parseBound(toMatch[1], asDate) : undefined,
  )
  if (min != null) rule.min = min
  if (max != null) rule.max = max

  // If from/to look like dates but type unset, treat as date
  if (!rule.type && (fromMatch?.[1]?.match(/^\d{4}-\d{2}-\d{2}$/) || toMatch?.[1]?.match(/^\d{4}-\d{2}-\d{2}$/))) {
    rule.type = 'date'
    const rebuilt = normalizeMinMax(
      fromMatch ? parseBound(fromMatch[1], true) : undefined,
      toMatch ? parseBound(toMatch[1], true) : undefined,
    )
    if (rebuilt.min != null) rule.min = rebuilt.min
    if (rebuilt.max != null) rule.max = rebuilt.max
  }

  return rule
}

function columnFromRule(rule: ColumnRule, existing?: SchemaColumn): SchemaColumn {
  const type = rule.type ?? existing?.type ?? guessTypeFromName(rule.name)
  const fakerPath =
    rule.type && (!existing || rule.type !== existing.type)
      ? defaultFakerForType(rule.type)
      : (existing?.fakerPath ?? defaultFakerForType(type))

  const { min, max } = normalizeMinMax(
    rule.min ?? existing?.min,
    rule.max ?? existing?.max,
  )

  return {
    name: existing?.name ?? rule.name,
    type,
    fakerPath,
    notes: existing?.notes,
    enumValues: existing?.enumValues,
    min,
    max,
    notNull: rule.notNull ?? existing?.notNull ?? true,
    unique: rule.unique ?? existing?.unique ?? false,
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
  const looksLikeKv =
    lines.some((l) => l.includes(':')) && lines.every((l) => !l.includes(',') || l.includes(':'))
  if (looksLikeKv) {
    return lines.map(parseLineRule).filter((r): r is ColumnRule => r != null)
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
      const minKey = keys.find((k) => /^(min|from)$/i.test(k))
      const maxKey = keys.find((k) => /^(max|to)$/i.test(k))
      if (notNullKey) mapped.not_null = row[notNullKey]
      if (notNullKey && /nullable/i.test(notNullKey)) {
        mapped.nullable = row[notNullKey]
        delete mapped.not_null
      }
      if (uniqueKey) mapped.unique = row[uniqueKey]
      if (typeKey) mapped.type = row[typeKey]
      if (minKey) mapped.from = row[minKey]
      if (maxKey) mapped.to = row[maxKey]
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
    return columnFromRule(rule, col)
  })

  for (const rule of rules) {
    if (used.has(rule.name.toLowerCase())) continue
    if (columns.some((c) => c.name.toLowerCase() === rule.name.toLowerCase())) continue
    columns.push(columnFromRule(rule))
  }

  return { ...plan, columns }
}

/** Build a plan from rules alone when no sample rows are provided. */
export function planFromColumnRules(rules: ColumnRule[]): SchemaPlan {
  if (rules.length === 0) {
    throw new Error('Provide a sample and/or column rules')
  }
  return {
    columns: rules.map((rule) => columnFromRule(rule)),
    rows: [],
    source: 'sample',
  }
}

function formatBound(col: SchemaColumn, value: number): string {
  if (col.type === 'date') {
    return new Date(value).toISOString().slice(0, 10)
  }
  return String(value)
}

export function formatColumnConstraints(col: SchemaColumn): string {
  const bits: string[] = [col.type]
  if (col.unique) bits.push('unique')
  if (col.notNull === false) bits.push('nullable')
  else bits.push('not null')
  if (col.min != null || col.max != null) {
    const from = col.min != null ? formatBound(col, col.min) : '…'
    const to = col.max != null ? formatBound(col, col.max) : '…'
    bits.push(`${from}–${to}`)
  }
  return `${col.name}(${bits.join(', ')})`
}
