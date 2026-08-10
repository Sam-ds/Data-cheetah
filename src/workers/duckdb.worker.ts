/// <reference lib="webworker" />

import * as duckdb from '@duckdb/duckdb-wasm'
import duckdbMvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import duckdbEhWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import duckdbMvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdbEhWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import type { DuckDBRequest, DuckDBResponse } from './types/messages'
import type { ColumnSchema, FileFormat } from '@/types/dataset'
import type { ColumnProfile } from '@/types/profile'

/** Bundle DuckDB WASM + workers with the app build (demo / initial release). */
const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdbMvpWasm,
    mainWorker: duckdbMvpWorker,
  },
  eh: {
    mainModule: duckdbEhWasm,
    mainWorker: duckdbEhWorker,
  },
}

let pendingMemoryLimit = '1GB'

let db: duckdb.AsyncDuckDB | null = null
let conn: duckdb.AsyncDuckDBConnection | null = null
const registeredTables = new Map<string, string>()

async function ensureDb(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn

  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
  const worker = new Worker(bundle.mainWorker!)
  const logger = new duckdb.ConsoleLogger()
  db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  conn = await db.connect()
  const limit = pendingMemoryLimit.replace(/'/g, '')
  await conn.query(`SET memory_limit='${limit}'`)
  return conn
}

/** Convert Arrow/DuckDB Row proxies into plain objects safe for postMessage. */
function formatYmdUtc(value: Date): string {
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, '0')
  const d = String(value.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isDateOnlyArrowType(typeName: string): boolean {
  const u = typeName.toUpperCase()
  // Arrow Date32/Date64, DuckDB DATE — not TIMESTAMP / DateTime
  if (u.includes('TIMESTAMP') || u.includes('DATETIME') || u.includes('TIME ZONE')) return false
  return (
    u.includes('DATEDAY') ||
    u.includes('DATE32') ||
    u.includes('DATE64') ||
    u.includes('DATEMILLISECOND') ||
    /^DATE$/i.test(typeName.trim()) ||
    /\bDATE\b/.test(u)
  )
}

function isTimestampArrowType(typeName: string): boolean {
  const u = typeName.toUpperCase()
  return u.includes('TIMESTAMP') || u.includes('DATETIME') || u.includes('TIMESTAMPTZ')
}

function isMidnightUtc(value: Date): boolean {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  )
}

/** Arrow Date32 = days since epoch; Date64/Timestamp = ms/us/ns depending on type string. */
function formatTemporalNumber(value: number | bigint, typeName: string): string {
  const n = typeof value === 'bigint' ? Number(value) : value
  if (!Number.isFinite(n)) return String(value)

  const u = typeName.toUpperCase()

  // Date32 / DateDay: integer days since Unix epoch
  if (
    u.includes('DATEDAY') ||
    u.includes('DATE32') ||
    (isDateOnlyArrowType(typeName) && !u.includes('DATE64') && !u.includes('MILLISECOND'))
  ) {
    // Guard: if value looks like ms already (> ~year 2100 in days), treat as ms
    if (Math.abs(n) > 100_000) {
      return formatYmdUtc(new Date(n))
    }
    return formatYmdUtc(new Date(n * 86_400_000))
  }

  // Date64: milliseconds since epoch
  if (u.includes('DATE64') || (u.includes('DATE') && u.includes('MILLISECOND'))) {
    return formatYmdUtc(new Date(n))
  }

  let ms = n
  if (u.includes('NANO')) ms = n / 1e6
  else if (u.includes('MICRO') || u.includes('[US]') || u.includes('US]')) ms = n / 1e3
  else if ((/\bSECOND\b/.test(u) || u.includes('[S]')) && !u.includes('MILLI') && !u.includes('MICRO')) {
    ms = n * 1000
  } else if (!u.includes('MILLI') && Math.abs(n) > 1e14) {
    // DuckDB often returns TIMESTAMP as microseconds without a clear unit in the type string
    ms = n / 1e3
  } else if (!u.includes('MILLI') && Math.abs(n) > 1e11 && Math.abs(n) <= 1e14) {
    ms = n // already ms
  }

  const d = new Date(ms)
  if (!Number.isFinite(d.getTime())) return String(value)
  // Date-only midnights (common when CSV DATE was inferred as TIMESTAMP)
  if (isDateOnlyArrowType(typeName) || isMidnightUtc(d)) {
    return formatYmdUtc(d)
  }
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function serializeValue(value: unknown, typeName?: string): unknown {
  if (value == null) return null

  const type = typeName ?? ''
  const temporal = isDateOnlyArrowType(type) || isTimestampArrowType(type)

  if (typeof value === 'bigint') {
    if (temporal) return formatTemporalNumber(value, type)
    const asNum = Number(value)
    // Huge ints from Arrow timestamps when type string is missing/opaque
    if (Math.abs(asNum) > 1e11) {
      return formatTemporalNumber(value, type || 'TIMESTAMP[us]')
    }
    return asNum
  }

  if (typeof value === 'number') {
    if (temporal) return formatTemporalNumber(value, type)
    return value
  }

  if (typeof value === 'string' || typeof value === 'boolean') return value

  if (value instanceof Date) {
    if (isDateOnlyArrowType(type) || isMidnightUtc(value)) {
      return formatYmdUtc(value)
    }
    return value.toISOString().replace(/\.\d{3}Z$/, 'Z')
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>)
  }
  if (Array.isArray(value)) return value.map((v) => serializeValue(v, typeName))
  if (typeof value === 'object') {
    // Arrow sometimes wraps scalars
    const maybeValueOf = value as { valueOf?: () => unknown; toJSON?: () => unknown }
    if (typeof maybeValueOf.valueOf === 'function') {
      const raw = maybeValueOf.valueOf()
      if (raw !== value && (typeof raw === 'number' || typeof raw === 'bigint' || raw instanceof Date)) {
        return serializeValue(raw, typeName)
      }
    }
    if (typeof maybeValueOf.toJSON === 'function') {
      return serializeValue(maybeValueOf.toJSON(), typeName)
    }
    const plain: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      plain[key] = serializeValue(nested)
    }
    return plain
  }
  return String(value)
}

type ArrowLikeResult = {
  schema: { fields: { name: string; type?: unknown }[] }
  numRows?: number
  toArray: () => unknown[]
  getChildAt?: (index: number) => { get: (row: number) => unknown } | null
}

function fieldTypeName(field: { type?: unknown }): string {
  const t = field.type
  if (t == null) return ''
  if (typeof t === 'string') return t
  if (typeof t === 'object') {
    const obj = t as {
      toString?: () => string
      typeId?: number
      unit?: unknown
      name?: string
    }
    const parts: string[] = []
    if (typeof obj.toString === 'function') {
      const s = obj.toString()
      if (s && s !== '[object Object]') parts.push(s)
    }
    if (obj.typeId != null) parts.push(`typeId:${obj.typeId}`)
    if (obj.unit != null) parts.push(`unit:${String(obj.unit)}`)
    if (obj.name) parts.push(obj.name)
    if (parts.length) return parts.join(' ')
  }
  return String(t)
}

function serializeRows(result: ArrowLikeResult): Record<string, unknown>[] {
  const columns = result.schema.fields.map((f) => f.name)
  const types = result.schema.fields.map((f) => fieldTypeName(f))
  const arrays = result.toArray()

  if (arrays.length > 0) {
    return arrays.map((row) => {
      const plain: Record<string, unknown> = {}
      if (Array.isArray(row)) {
        columns.forEach((col, i) => {
          plain[col] = serializeValue(row[i], types[i])
        })
        return plain
      }
      const record = row as Record<string, unknown> & { get?: (i: number) => unknown }
      columns.forEach((col, i) => {
        let value: unknown = record[col]
        if (value === undefined && typeof record.get === 'function') {
          value = record.get(i)
        }
        plain[col] = serializeValue(value, types[i])
      })
      return plain
    })
  }

  // Some Arrow builds report numRows but yield an empty toArray()
  const numRows = result.numRows ?? 0
  if (numRows > 0 && typeof result.getChildAt === 'function') {
    const rows: Record<string, unknown>[] = []
    for (let r = 0; r < numRows; r++) {
      const plain: Record<string, unknown> = {}
      for (let c = 0; c < columns.length; c++) {
        plain[columns[c]] = serializeValue(result.getChildAt(c)?.get(r), types[c])
      }
      rows.push(plain)
    }
    return rows
  }

  return []
}

function sqlQuoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function sqlQuotePath(name: string): string {
  return `'${name.replace(/'/g, "''")}'`
}

function getReadSql(fileName: string, format: FileFormat): string {
  const path = sqlQuotePath(fileName)
  switch (format) {
    case 'csv':
      // Prefer DATE for YYYY-MM-DD values; keep TIMESTAMP available for real datetimes
      return `SELECT * FROM read_csv_auto(${path}, header=true, dateformat='%Y-%m-%d')`
    case 'parquet':
      return `SELECT * FROM read_parquet(${path})`
    case 'json':
      if (/\.(jsonl|ndjson)$/i.test(fileName)) {
        return `SELECT * FROM read_json_auto(${path}, format='newline_delimited')`
      }
      return `SELECT * FROM read_json_auto(${path}, format='array')`
    case 'xlsx':
      return `SELECT * FROM read_csv_auto(${path}, header=true, dateformat='%Y-%m-%d')`
  }
}

async function registerFile(
  name: string,
  buffer: ArrayBuffer,
  format: FileFormat,
  tableName: string,
): Promise<{ schema: ColumnSchema[]; rowCount: number }> {
  const connection = await ensureDb()
  await db!.registerFileBuffer(name, new Uint8Array(buffer))

  const readSql = getReadSql(name, format)
  const quoted = sqlQuoteIdent(tableName)
  // Materialize into a TABLE so queries do not depend on ephemeral file-buffer views
  await connection.query(`DROP TABLE IF EXISTS ${quoted}`)
  await connection.query(`DROP VIEW IF EXISTS ${quoted}`)
  await connection.query(`CREATE TABLE ${quoted} AS ${readSql}`)
  registeredTables.set(tableName, name)

  // Verify the table is queryable before reporting success
  const countResult = await connection.query(`SELECT COUNT(*) as cnt FROM ${quoted}`)
  const countRows = serializeRows(countResult)
  const rowCount = Number(countRows[0]?.cnt ?? 0)

  const schemaResult = await connection.query(`DESCRIBE ${quoted}`)
  const schemaRows = serializeRows(schemaResult)
  const schema: ColumnSchema[] = schemaRows.map((r) => ({
    name: String(r.column_name),
    type: String(r.column_type),
  }))

  return { schema, rowCount }
}

async function executeSql(
  sql: string,
  limit?: number,
): Promise<{
  columns: string[]
  columnTypes: string[]
  rows: Record<string, unknown>[]
  totalRows?: number
  durationMs: number
}> {
  const connection = await ensureDb()
  const start = performance.now()

  let execSql = sql.trim()
  if (limit && !/\blimit\b/i.test(execSql)) {
    execSql = execSql.replace(/;\s*$/, '')
    execSql = `${execSql} LIMIT ${limit}`
  }

  const result = await connection.query(execSql)
  const rows = serializeRows(result)
  const durationMs = performance.now() - start

  const columns = result.schema.fields.map((f) => f.name)
  const columnTypes = result.schema.fields.map((f) => String(f.type))

  return { columns, columnTypes, rows, durationMs }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

async function dedupStats(tableName: string): Promise<{
  tableName: string
  totalRows: number
  distinctRows: number
  duplicateRows: number
  columnCount: number
}> {
  const connection = await ensureDb()
  const t = quoteIdent(tableName)

  const schemaResult = await connection.query(`DESCRIBE ${t}`)
  const columnCount = serializeRows(schemaResult).length

  const result = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM ${t})::BIGINT AS total_rows,
      (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM ${t}))::BIGINT AS distinct_rows
  `)
  const row = serializeRows(result)[0]
  const totalRows = Number(row?.total_rows ?? 0)
  const distinctRows = Number(row?.distinct_rows ?? 0)
  return {
    tableName,
    totalRows,
    distinctRows,
    duplicateRows: Math.max(0, totalRows - distinctRows),
    columnCount,
  }
}

async function exportSql(
  sql: string,
  format: 'csv' | 'json' | 'parquet',
  preferredName?: string,
): Promise<{ buffer: ArrayBuffer; fileName: string; mime: string }> {
  const connection = await ensureDb()
  if (!db) throw new Error('DuckDB not initialized')

  const ext = format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'parquet'
  const mime =
    format === 'csv'
      ? 'text/csv'
      : format === 'json'
        ? 'application/json'
        : 'application/vnd.apache.parquet'
  const virtualPath = `/tmp/dc_export_${crypto.randomUUID()}.${ext}`
  const downloadName = preferredName?.trim() || `export.${ext}`

  try {
    await db.dropFile(virtualPath)
  } catch {
    /* ignore missing */
  }

  let copySql: string
  if (format === 'csv') {
    copySql = `COPY (${sql}) TO '${virtualPath}' (HEADER, DELIMITER ',')`
  } else if (format === 'json') {
    copySql = `COPY (${sql}) TO '${virtualPath}' (FORMAT JSON, ARRAY true)`
  } else {
    copySql = `COPY (${sql}) TO '${virtualPath}' (FORMAT PARQUET)`
  }

  await connection.query(copySql)
  const bytes = await db.copyFileToBuffer(virtualPath)
  try {
    await db.dropFile(virtualPath)
  } catch {
    /* ignore */
  }

  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return { buffer, fileName: downloadName, mime }
}

async function profileTable(tableName: string): Promise<{ columns: ColumnProfile[]; duplicateCount: number }> {
  const connection = await ensureDb()
  const t = quoteIdent(tableName)

  const schemaResult = await connection.query(`DESCRIBE ${t}`)
  const schemaRows = serializeRows(schemaResult)

  const columns: ColumnProfile[] = []

  for (const col of schemaRows) {
    const profile = await profileColumn(tableName, String(col.column_name), String(col.column_type))
    columns.push(profile)
  }

  let duplicateCount = 0
  try {
    const dupResult = await connection.query(`
      SELECT COUNT(*) - (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM ${t})) as dup_count
      FROM ${t}
    `)
    const dupRows = serializeRows(dupResult)
    duplicateCount = Number(dupRows[0]?.dup_count ?? 0)
  } catch {
    duplicateCount = 0
  }

  return { columns, duplicateCount }
}

async function profileColumn(tableName: string, column: string, dataType: string): Promise<ColumnProfile> {
  const connection = await ensureDb()
  const quotedCol = `"${column}"`

  const statsResult = await connection.query(`
    SELECT
      COUNT(*) AS total_rows,
      COUNT(${quotedCol}) AS non_null_count,
      ROUND(100.0 * (COUNT(*) - COUNT(${quotedCol})) / NULLIF(COUNT(*), 0), 2) AS null_pct,
      COUNT(DISTINCT ${quotedCol}) AS distinct_count,
      MIN(${quotedCol}) AS min_val,
      MAX(${quotedCol}) AS max_val,
      AVG(TRY_CAST(${quotedCol} AS DOUBLE)) AS avg_val,
      MEDIAN(TRY_CAST(${quotedCol} AS DOUBLE)) AS median_val
    FROM "${tableName}"
  `)

  const stats = serializeRows(statsResult)[0] ?? {}

  let topValues: { value: unknown; frequency: number }[] = []
  try {
    const topResult = await connection.query(`
      SELECT ${quotedCol} AS value, COUNT(*) AS freq
      FROM "${tableName}"
      WHERE ${quotedCol} IS NOT NULL
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 5
    `)
    topValues = serializeRows(topResult).map((r) => ({
      value: r.value,
      frequency: Number(r.freq),
    }))
  } catch {
    topValues = []
  }

  return {
    columnName: column,
    dataType,
    totalRows: Number(stats.total_rows ?? 0),
    nonNullCount: Number(stats.non_null_count ?? 0),
    nullPct: Number(stats.null_pct ?? 0),
    distinctCount: Number(stats.distinct_count ?? 0),
    minVal: stats.min_val,
    maxVal: stats.max_val,
    avgVal: stats.avg_val != null ? Number(stats.avg_val) : null,
    medianVal: stats.median_val != null ? Number(stats.median_val) : null,
    topValues,
  }
}

function respond(response: DuckDBResponse) {
  self.postMessage(response)
}

self.onmessage = async (event: MessageEvent<DuckDBRequest>) => {
  const msg = event.data

  try {
    switch (msg.type) {
      case 'INIT': {
        if (msg.payload?.memoryLimit) {
          pendingMemoryLimit = msg.payload.memoryLimit
        }
        await ensureDb()
        respond({ id: msg.id, type: 'READY' })
        break
      }

      case 'REGISTER_FILE': {
        const { name, buffer, format, tableName } = msg.payload
        const registerName = format === 'xlsx' ? name.replace(/\.xlsx?$/i, '.csv') : name

        const { schema, rowCount } = await registerFile(registerName, buffer, format, tableName)
        respond({
          id: msg.id,
          type: 'FILE_REGISTERED',
          payload: { tableName, schema, rowCount },
        })
        break
      }

      case 'EXECUTE_SQL': {
        const result = await executeSql(msg.payload.sql, msg.payload.limit)
        respond({ id: msg.id, type: 'QUERY_RESULT', payload: result })
        break
      }

      case 'GET_SCHEMA': {
        const connection = await ensureDb()
        const result = await connection.query(`DESCRIBE "${msg.payload.tableName}"`)
        const schemaRows = serializeRows(result)
        respond({
          id: msg.id,
          type: 'SCHEMA_RESULT',
          payload: {
            schema: schemaRows.map((r) => ({
              name: String(r.column_name),
              type: String(r.column_type),
            })),
          },
        })
        break
      }

      case 'GET_PREVIEW': {
        const connection = await ensureDb()
        const result = await connection.query(
          `SELECT * FROM "${msg.payload.tableName}" LIMIT ${msg.payload.limit}`,
        )
        respond({
          id: msg.id,
          type: 'PREVIEW_RESULT',
          payload: { rows: serializeRows(result) },
        })
        break
      }

      case 'PROFILE_TABLE': {
        const profile = await profileTable(msg.payload.tableName)
        respond({ id: msg.id, type: 'PROFILE_RESULT', payload: profile })
        break
      }

      case 'DEDUP_STATS': {
        const stats = await dedupStats(msg.payload.tableName)
        respond({ id: msg.id, type: 'DEDUP_STATS_RESULT', payload: stats })
        break
      }

      case 'EXPORT_SQL': {
        const exported = await exportSql(
          msg.payload.sql,
          msg.payload.format,
          msg.payload.fileName,
        )
        respond({ id: msg.id, type: 'EXPORT_RESULT', payload: exported })
        break
      }

      case 'DISPOSE': {
        if (conn) {
          await conn.close()
          conn = null
        }
        if (db) {
          await db.terminate()
          db = null
        }
        registeredTables.clear()
        respond({ id: msg.id, type: 'READY' })
        break
      }
    }
  } catch (error) {
    respond({
      id: msg.id,
      type: 'ERROR',
      payload: { message: error instanceof Error ? error.message : String(error) },
    })
  }
}
