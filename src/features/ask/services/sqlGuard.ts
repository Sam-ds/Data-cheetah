/** Strip markdown fences and extract a balanced JSON value. Prefer arrays when asked. */
export function extractJsonText(raw: string, prefer: 'array' | 'any' = 'any'): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = (fenced?.[1] ?? trimmed).trim()

  const arrStart = source.indexOf('[')
  const objStart = source.indexOf('{')
  if (arrStart === -1 && objStart === -1) return source

  let start: number
  if (prefer === 'array' && arrStart !== -1) {
    start = arrStart
  } else if (arrStart === -1) {
    start = objStart
  } else if (objStart === -1) {
    start = arrStart
  } else {
    start = Math.min(arrStart, objStart)
  }

  return extractBalanced(source, start) ?? source
}

function extractBalanced(source: string, start: number): string | null {
  const open = source[start]
  const close = open === '[' ? ']' : '}'
  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return null
}

/** Parse JSON from messy LLM output (fences, trailing prose, etc.). */
export function parseModelJson(raw: string, prefer: 'array' | 'any' = 'any'): unknown {
  const attempts = [
    extractJsonText(raw, prefer),
    prefer === 'array' ? extractJsonText(raw, 'any') : null,
  ].filter((v): v is string => Boolean(v))

  let lastError: unknown
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate)
    } catch (err) {
      lastError = err
      for (let end = candidate.length; end > 1; end--) {
        const slice = candidate.slice(0, end).trim()
        if (!slice.endsWith('}') && !slice.endsWith(']')) continue
        try {
          return JSON.parse(slice)
        } catch {
          /* keep shrinking */
        }
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Could not parse JSON from model response.')
}

/**
 * Allow a single read-only SELECT / WITH…SELECT.
 * Rejects write/DDL and obvious multi-statement scripts.
 */
export function scrubSqlExtractionJunk(sql: string): string {
  let s = sql.trim()
  // Drop markdown / JSON wrappers commonly left by bad LLM extraction
  s = s.replace(/^```(?:sql|json)?\s*/i, '').replace(/```$/i, '').trim()
  // e.g. ... = 1984"}} or ... = 1984"} or ... LIMIT 10}}
  s = s.replace(/"*\s*\}+\s*$/g, '')
  s = s.replace(/;+\s*$/g, '').trim()
  return s
}

/**
 * DuckDB does not accept MySQL/BigQuery backticks. Convert `ident` → "ident".
 * Leaves content inside normal '…' string literals alone.
 */
export function repairMysqlBackticks(sql: string): string {
  const masks: string[] = []
  const masked = sql.replace(/'(?:[^']|'')*'/g, (m) => {
    const token = `\u0000SQ${masks.length}\u0000`
    masks.push(m)
    return token
  })

  const converted = masked.replace(/`([^`\\]+)`/g, (_full, inner: string) => {
    const name = inner.trim()
    if (!name) return '""'
    return `"${name.replace(/"/g, '""')}"`
  })

  // Any leftover stray backticks (unpaired) → drop them
  const cleaned = converted.replace(/`/g, '')

  return cleaned.replace(/\u0000SQ(\d+)\u0000/g, (_, i: string) => masks[Number(i)] ?? '')
}

export function guardSelectSql(rawSql: string): string {
  let sql = scrubSqlExtractionJunk(rawSql)
  sql = repairMysqlBackticks(sql)

  if (!sql) throw new Error('Model returned empty SQL.')

  if (sql.includes(';')) {
    throw new Error('Only a single SQL statement is allowed.')
  }

  const banned =
    /\b(insert|update|delete|drop|alter|create|attach|detach|copy|pragma|export|import|call|execute|grant|revoke)\b/i
  if (banned.test(sql)) {
    throw new Error('Only read-only SELECT queries are allowed.')
  }

  if (!/^\s*(with|select)\b/i.test(sql)) {
    throw new Error('SQL must start with SELECT or WITH.')
  }

  return sql
}

/** Read a JSON string value starting at the opening quote index. */
function readJsonString(source: string, openQuoteIndex: number): string | null {
  if (source[openQuoteIndex] !== '"') return null
  let escape = false
  let out = ''
  for (let i = openQuoteIndex + 1; i < source.length; i++) {
    const ch = source[i]
    if (escape) {
      if (ch === 'n') out += '\n'
      else if (ch === 'r') out += '\r'
      else if (ch === 't') out += '\t'
      else out += ch
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') return out
    out += ch
  }
  return null
}

/** Collect every JSON string value for the given object keys (does not stop at the first). */
export function extractAllQuotedFields(source: string, keys: string[]): string[] {
  const keyAlt = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const key = new RegExp(`"(?:${keyAlt})"\\s*:\\s*`, 'gi')
  const out: string[] = []
  let match: RegExpExecArray | null
  while ((match = key.exec(source)) !== null) {
    const valueStart = match.index + match[0].length
    if (source[valueStart] === '"') {
      const value = readJsonString(source, valueStart)
      if (value?.trim()) out.push(value.trim())
    }
  }
  return out
}

function extractSqlFieldFromText(source: string): string | null {
  return extractAllQuotedFields(source, ['sql', 'query', 'statement'])[0] ?? null
}

/**
 * Split semicolon-separated read-only statements (respects quotes).
 * Used when a model packs multiple SELECTs into one "sql" string.
 */
export function splitSelectStatements(sql: string): string[] {
  const cleaned = scrubSqlExtractionJunk(sql)
  if (!cleaned) return []

  const parts: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!
    if (inSingle) {
      current += ch
      if (ch === "'") {
        if (cleaned[i + 1] === "'") {
          current += cleaned[++i]
          continue
        }
        inSingle = false
      }
      continue
    }
    if (inDouble) {
      current += ch
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          current += cleaned[++i]
          continue
        }
        inDouble = false
      }
      continue
    }
    if (ch === "'") {
      inSingle = true
      current += ch
      continue
    }
    if (ch === '"') {
      inDouble = true
      current += ch
      continue
    }
    if (ch === ';') {
      const t = current.trim()
      if (t) parts.push(t)
      current = ''
      continue
    }
    current += ch
  }
  const tail = current.trim()
  if (tail) parts.push(tail)
  return parts
}

export type ExtractedPlanStep = { goal: string; sql: string }

/**
 * Pull 1–N plan steps from messy LLM plan output.
 * Prefers a full `steps` array; falls back to every `"sql"` field (not just the first).
 */
export function extractPlanStepsFromModelRaw(raw: string, maxSteps = 3): ExtractedPlanStep[] {
  const trimmed = raw.trim()
  const source = trimmed.replace(/^```(?:json|sql)?\s*/i, '').replace(/```$/i, '').trim()
  const sqlFieldCount = extractAllQuotedFields(source, ['sql', 'query', 'statement']).length

  const fromList = (list: unknown[]): ExtractedPlanStep[] => {
    const steps: ExtractedPlanStep[] = []
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const sqlRaw = String(rec.sql ?? rec.query ?? '').trim()
      if (!sqlRaw) continue
      const pieces = splitSelectStatements(sqlRaw)
      const goalBase = String(rec.goal ?? rec.purpose ?? rec.title ?? '').trim()
      for (const piece of pieces.length ? pieces : [sqlRaw]) {
        steps.push({
          goal: goalBase || `Step ${steps.length + 1}`,
          sql: piece,
        })
        if (steps.length >= maxSteps) return steps
      }
    }
    return steps
  }

  try {
    const parsed = parseModelJson(raw, 'any') as Record<string, unknown> | unknown[]
    if (Array.isArray(parsed)) {
      const steps = fromList(parsed)
      // Truncated JSON recovery sometimes keeps only step 1 — prefer field scan if more sql keys exist
      if (steps.length > 0 && !(steps.length === 1 && sqlFieldCount > 1)) return steps.slice(0, maxSteps)
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.steps)) {
        const steps = fromList(parsed.steps)
        if (steps.length > 0 && !(steps.length === 1 && sqlFieldCount > 1)) {
          return steps.slice(0, maxSteps)
        }
      }
      const single = String(parsed.sql ?? parsed.query ?? '').trim()
      if (single && sqlFieldCount <= 1) {
        const pieces = splitSelectStatements(single)
        if (pieces.length > 1) {
          return pieces.slice(0, maxSteps).map((sql, i) => ({
            goal: `Step ${i + 1}`,
            sql,
          }))
        }
        return [{ goal: 'Answer question', sql: pieces[0] ?? single }]
      }
    }
  } catch {
    /* fall through to field scan */
  }

  const sqls = extractAllQuotedFields(source, ['sql', 'query', 'statement'])
  const goals = extractAllQuotedFields(source, ['goal', 'purpose', 'title'])
  if (sqls.length > 0) {
    const steps: ExtractedPlanStep[] = []
    for (let i = 0; i < sqls.length && steps.length < maxSteps; i++) {
      const pieces = splitSelectStatements(sqls[i]!)
      for (const piece of pieces.length ? pieces : [sqls[i]!]) {
        steps.push({
          goal: goals[i] ?? goals[steps.length] ?? `Step ${steps.length + 1}`,
          sql: piece,
        })
        if (steps.length >= maxSteps) break
      }
    }
    if (steps.length > 0) return steps
  }

  try {
    const sql = extractSqlFromModel(raw)
    const pieces = splitSelectStatements(sql)
    if (pieces.length > 1) {
      return pieces.slice(0, maxSteps).map((s, i) => ({ goal: `Step ${i + 1}`, sql: s }))
    }
    if (sql) return [{ goal: 'Answer question', sql }]
  } catch {
    /* ignore */
  }
  return []
}

/** Pull SELECT SQL from messy model output (JSON sql/query fields, fences, or raw SQL). */
export function extractSqlFromModel(raw: string): string {
  const trimmed = raw.trim()
  const source = trimmed.replace(/^```(?:json|sql)?\s*/i, '').replace(/```$/i, '').trim()

  // 1) Direct "sql":"..." field (robust when surrounding JSON is broken)
  const field = extractSqlFieldFromText(source)
  if (field) {
    return guardSelectSql(field)
  }

  // 2) Balanced JSON object with sql/query
  let searchFrom = 0
  while (searchFrom < source.length) {
    const objStart = source.indexOf('{', searchFrom)
    if (objStart === -1) break
    const balanced = extractBalanced(source, objStart)
    if (!balanced) break
    try {
      const parsed = JSON.parse(balanced) as Record<string, unknown>
      const candidate = parsed.sql ?? parsed.query ?? parsed.statement
      if (typeof candidate === 'string' && candidate.trim()) {
        return guardSelectSql(candidate)
      }
    } catch {
      /* keep scanning */
    }
    searchFrom = objStart + 1
  }

  // 3) ```sql ... ```
  const sqlFence = trimmed.match(/```(?:sql)?\s*([\s\S]*?)```/i)
  if (sqlFence?.[1]) {
    try {
      return guardSelectSql(sqlFence[1])
    } catch {
      /* continue */
    }
  }

  // 4) Raw SELECT/WITH — stop before trailing JSON junk
  const selectMatch = source.match(/\b(with|select)\b[\s\S]*/i)
  if (selectMatch) {
    let chunk = selectMatch[0].split(';')[0] ?? selectMatch[0]
    // Cut at the first JSON-looking closer after the SQL (e.g. "} or "}})
    const junkAt = chunk.search(/"\s*\}/)
    if (junkAt !== -1) chunk = chunk.slice(0, junkAt)
    return guardSelectSql(chunk)
  }

  return guardSelectSql(trimmed)
}

/**
 * DuckDB: "name" = identifier, 'text' = string.
 * Small models often emit country = "US" which becomes Binder Error on column "US".
 * Convert double-quoted tokens that are not known table/column names into string literals.
 */
export function repairDuckdbStringQuotes(sql: string, knownIdentifiers: Iterable<string>): string {
  const known = new Set<string>()
  for (const id of knownIdentifiers) {
    const t = id.trim()
    if (!t) continue
    known.add(t)
    known.add(t.toLowerCase())
  }

  return sql.replace(/"([^"]*)"/g, (full, inner: string) => {
    if (known.has(inner) || known.has(inner.toLowerCase())) {
      return full
    }
    // Likely a mistaken string literal (e.g. "US", "Atlanta")
    return `'${inner.replace(/'/g, "''")}'`
  })
}

/** Collect table + column names that must stay double-quoted as identifiers. */
export function collectSqlIdentifiers(contexts: { tableName: string; columns: { name: string }[] }[]): string[] {
  const ids: string[] = []
  for (const c of contexts) {
    ids.push(c.tableName)
    for (const col of c.columns) ids.push(col.name)
  }
  return ids
}

export function collectTableNames(contexts: { tableName: string }[]): string[] {
  return contexts.map((c) => c.tableName).filter(Boolean)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** True when DuckDB requires double quotes (spaces, punctuation, mixed case, leading digit, etc.). */
export function needsQuotedIdentifier(name: string): boolean {
  // Unquoted ids fold to lowercase in DuckDB — quote anything that isn't already lowercase snake/idents.
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) return true
  return false
}

/**
 * Quote known table/column names that contain spaces or special characters when the
 * model emits them bare, e.g. Subscription Date → "Subscription Date".
 * Skips text already inside '…' strings or "…" identifiers.
 */
export function repairUnquotedIdentifiers(sql: string, knownIdentifiers: Iterable<string>): string {
  const ids = [
    ...new Set(
      [...knownIdentifiers]
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && needsQuotedIdentifier(s)),
    ),
  ].sort((a, b) => b.length - a.length)

  if (ids.length === 0) return sql

  const masks: string[] = []
  let masked = sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"/g, (m) => {
    const token = `\u0000MASK${masks.length}\u0000`
    masks.push(m)
    return token
  })

  for (const id of ids) {
    const pattern = new RegExp(`(?<![\\w.])${escapeRegExp(id)}(?![\\w.])`, 'gi')
    masked = masked.replace(pattern, `"${id.replace(/"/g, '""')}"`)
  }

  return masked.replace(/\u0000MASK(\d+)\u0000/g, (_, i: string) => masks[Number(i)] ?? '')
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function closestTableName(name: string, tableNames: string[]): string | null {
  if (tableNames.length === 0) return null
  const lower = name.toLowerCase()
  const exact = tableNames.find((t) => t.toLowerCase() === lower)
  if (exact) return exact

  let best: string | null = null
  let bestDist = Infinity
  for (const t of tableNames) {
    const d = levenshtein(lower, t.toLowerCase())
    if (d < bestDist) {
      bestDist = d
      best = t
    }
  }
  if (!best) return null
  const threshold = Math.max(2, Math.floor(Math.max(name.length, best.length) * 0.4))
  return bestDist > 0 && bestDist <= threshold ? best : null
}

/**
 * Rewrite FROM/JOIN table refs to exact loaded table names (fixes books → boooks, etc.).
 */
export function repairUnknownTableNames(sql: string, tableNames: string[]): string {
  if (tableNames.length === 0) return sql

  return sql.replace(
    /\b(FROM|JOIN)\s+(?:(\w+)\.)?(")?([A-Za-z_][\w]*)\3/gi,
    (full, kw: string, schema: string | undefined, _quote: string | undefined, name: string) => {
      const match = closestTableName(name, tableNames)
      if (!match) return full
      const schemaPrefix = schema ? `${schema}.` : ''
      return `${kw} ${schemaPrefix}"${match}"`
    },
  )
}

/** Apply DuckDB "Did you mean …?" catalog hints when present. */
export function applyCatalogDidYouMean(sql: string, errorMessage: string): string | null {
  const missing = errorMessage.match(/Table with name\s+["']?(\w+)["']?\s+does not exist/i)
  const suggestion = errorMessage.match(/Did you mean\s+["']([^"']+)["']/i)
  if (!missing?.[1] || !suggestion?.[1]) return null
  const bad = missing[1]
  const good = suggestion[1]
  if (bad.toLowerCase() === good.toLowerCase()) return null
  const next = sql.replace(new RegExp(`\\b${escapeRegExp(bad)}\\b`, 'gi'), `"${good}"`)
  return next === sql ? null : next
}

function isDateLikeType(type: string): boolean {
  return /\b(date|timestamp|timestamptz|datetime)\b/i.test(type)
}

export function collectDateColumnNames(
  contexts: { columns: { name: string; type: string }[] }[],
): string[] {
  const names: string[] = []
  for (const c of contexts) {
    for (const col of c.columns) {
      if (isDateLikeType(col.type)) names.push(col.name)
    }
  }
  return names
}

/**
 * Fix DATE/TIMESTAMP compared to bare integers (years), e.g. order_date >= 1984
 * → order_date >= DATE '1984-01-01'. Also year equality → EXTRACT(year FROM col) = 1984.
 */
export function repairDateIntegerComparisons(sql: string, dateColumns: Iterable<string>): string {
  const cols = [...new Set([...dateColumns].map((c) => c.trim()).filter(Boolean))]
  if (cols.length === 0) {
    // Heuristic fallback: columns with date/time in the name
    return sql.replace(
      /(")?([A-Za-z_][\w]*)\1\s*(>=|<=|=|<>|!=|>|<)\s*(\d{4})\b/g,
      (full, _q: string | undefined, name: string, op: string, year: string) => {
        if (!/(date|time|day|month|year|ts|dob|created|updated|at)$/i.test(name) && !/^(date|time)/i.test(name)) {
          return full
        }
        return rewriteDateCompare(name, op, year)
      },
    )
  }

  let next = sql
  for (const col of cols) {
    const pattern = new RegExp(
      `(")?(${escapeRegExp(col)})\\1\\s*(>=|<=|=|<>|!=|>|<)\\s*(\\d{4})\\b`,
      'gi',
    )
    next = next.replace(pattern, (_full, _q: string | undefined, name: string, op: string, year: string) =>
      rewriteDateCompare(name, op, year),
    )
  }
  return next
}

function rewriteDateCompare(column: string, op: string, year: string): string {
  const y = Number(year)
  if (!Number.isFinite(y) || y < 1000 || y > 2100) {
    return `"${column}" ${op} ${year}`
  }
  const quoted = `"${column}"`
  if (op === '=') {
    return `EXTRACT(year FROM ${quoted}) = ${year}`
  }
  if (op === '<>' || op === '!=') {
    return `EXTRACT(year FROM ${quoted}) ${op} ${year}`
  }
  if (op === '>=' || op === '>') {
    const start = op === '>=' ? `${year}-01-01` : `${year}-12-31`
    // > year → after end of year; >= year → from Jan 1
    if (op === '>') {
      return `${quoted} > DATE '${year}-12-31'`
    }
    return `${quoted} >= DATE '${start}'`
  }
  if (op === '<=' || op === '<') {
    if (op === '<') {
      return `${quoted} < DATE '${year}-01-01'`
    }
    return `${quoted} <= DATE '${year}-12-31'`
  }
  return `${quoted} ${op} DATE '${year}-01-01'`
}

/** If binder error is DATE vs INTEGER, attempt the date/year repair once more. */
export function applyDateBinderRepair(
  sql: string,
  errorMessage: string,
  dateColumns: Iterable<string>,
): string | null {
  if (!/Cannot compare values of type DATE/i.test(errorMessage) && !/INTEGER_LITERAL/i.test(errorMessage)) {
    return null
  }
  if (!/DATE|TIMESTAMP/i.test(errorMessage) && !/INTEGER_LITERAL/i.test(errorMessage)) {
    return null
  }
  const repaired = repairDateIntegerComparisons(sql, dateColumns)
  return repaired === sql ? null : repaired
}
