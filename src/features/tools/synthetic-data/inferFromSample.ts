import Papa from 'papaparse'
import {
  normalizeFakerPath,
  type ColumnValueType,
  type FakerPath,
  type SchemaColumn,
  type SchemaPlan,
} from './schemaPlan'

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function looksLikeUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function looksLikeDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(v) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) return false
  const t = Date.parse(v)
  return !Number.isNaN(t)
}

function looksLikeUrl(v: string): boolean {
  return /^https?:\/\//i.test(v)
}

function looksLikePhone(v: string): boolean {
  const digits = v.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 && /[\d+\-()\s]/.test(v)
}

function inferPathAndType(name: string, values: unknown[]): { path: FakerPath; type: ColumnValueType } {
  const lower = name.toLowerCase()
  const strings = values.filter((v) => v != null && String(v).trim() !== '').map((v) => String(v).trim())

  if (/email/i.test(lower) || strings.some(looksLikeEmail)) {
    return { path: 'internet.email', type: 'string' }
  }
  if (/uuid|guid/i.test(lower) || strings.some(looksLikeUuid)) {
    return { path: 'string.uuid', type: 'string' }
  }
  if (/url|website|href/i.test(lower) || strings.some(looksLikeUrl)) {
    return { path: 'internet.url', type: 'string' }
  }
  if (/phone|mobile|tel/i.test(lower) || strings.some(looksLikePhone)) {
    return { path: 'phone.number', type: 'string' }
  }
  if (/first.?name/i.test(lower)) return { path: 'person.firstName', type: 'string' }
  if (/last.?name|surname/i.test(lower)) return { path: 'person.lastName', type: 'string' }
  if (/^(full.?name|name|customer|user)$/i.test(lower) || /full.?name/i.test(lower)) {
    return { path: 'person.fullName', type: 'string' }
  }
  if (/city/i.test(lower)) return { path: 'location.city', type: 'string' }
  if (/country/i.test(lower)) return { path: 'location.country', type: 'string' }
  if (/zip|postal/i.test(lower)) return { path: 'location.zipCode', type: 'string' }
  if (/address|street/i.test(lower)) return { path: 'location.streetAddress', type: 'string' }
  if (/company|org/i.test(lower)) return { path: 'company.name', type: 'string' }
  if (/product/i.test(lower)) return { path: 'commerce.productName', type: 'string' }
  if (/price|amount|cost|total/i.test(lower)) return { path: 'commerce.price', type: 'number' }
  if (/date|time|_at$|_on$/i.test(lower) || strings.some(looksLikeDate)) {
    return { path: 'date.past', type: 'date' }
  }
  if (/^(is_|has_|active|enabled|flag)/i.test(lower)) {
    return { path: 'datatype.boolean', type: 'boolean' }
  }

  const nums = strings.map((s) => Number(s)).filter((n) => !Number.isNaN(n))
  if (nums.length >= Math.max(1, Math.floor(strings.length * 0.7))) {
    const allInt = nums.every((n) => Number.isInteger(n))
    return allInt
      ? { path: 'number.int', type: 'integer' }
      : { path: 'number.float', type: 'number' }
  }

  if (/id$/i.test(lower) || /^id$/i.test(lower)) {
    return { path: 'number.int', type: 'integer' }
  }

  return { path: 'lorem.word', type: 'string' }
}

function parseSampleRows(sample: string): Record<string, unknown>[] {
  const trimmed = sample.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((r) => r && typeof r === 'object') as Record<string, unknown>[]
      }
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>
        for (const key of ['data', 'rows', 'items', 'records']) {
          if (Array.isArray(obj[key])) {
            return (obj[key] as unknown[]).filter((r) => r && typeof r === 'object') as Record<
              string,
              unknown
            >[]
          }
        }
        return [obj]
      }
    } catch {
      /* fall through to CSV */
    }
  }

  const parsed = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  if (parsed.errors.length && (!parsed.data || parsed.data.length === 0)) {
    throw new Error(parsed.errors[0]?.message || 'Could not parse sample as CSV or JSON')
  }
  return (parsed.data || []).filter((r) => r && Object.keys(r).length > 0)
}

/** Infer schema + use sample rows as seeds (no LLM). */
export function inferPlanFromSample(sample: string, maxSeedRows = 10): SchemaPlan {
  const rows = parseSampleRows(sample)
  if (rows.length === 0) {
    throw new Error('Paste a CSV or JSON sample with at least one row')
  }

  const names = Object.keys(rows[0]!)
  if (names.length === 0) {
    throw new Error('Sample rows have no columns')
  }

  const columns: SchemaColumn[] = names.map((name) => {
    const values = rows.map((r) => r[name])
    const { path, type } = inferPathAndType(name, values)
    const nums = values
      .map((v) => Number(v))
      .filter((n) => !Number.isNaN(n))
    const col: SchemaColumn = {
      name,
      type,
      fakerPath: normalizeFakerPath(path, path),
    }
    if (type === 'integer' || type === 'number') {
      if (nums.length) {
        col.min = Math.min(...nums)
        col.max = Math.max(...nums)
      }
    }
    return col
  })

  return {
    columns,
    rows: rows.slice(0, maxSeedRows),
    source: 'sample',
  }
}

export { parseSampleRows }
