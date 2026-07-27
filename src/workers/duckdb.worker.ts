/// <reference lib="webworker" />

import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import type { DuckDBRequest, DuckDBResponse } from './types/messages'
import type { ColumnSchema, FileFormat } from '@/types/dataset'
import type { ColumnProfile } from '@/types/profile'

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_wasm, mainWorker: mvp_worker },
  eh: { mainModule: duckdb_wasm_eh, mainWorker: eh_worker },
}

let db: duckdb.AsyncDuckDB | null = null
let conn: duckdb.AsyncDuckDBConnection | null = null
const registeredTables = new Map<string, string>()

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
  return u.includes('DATE') || /^DATE\d*/i.test(typeName)
}

function isMidnightUtc(value: Date): boolean {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  )
}

function serializeValue(value: unknown, typeName?: string): unknown {
  if (value == null) return null
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value
  if (value instanceof Date) {
    // DATE columns, or date-only midnight values mis-typed as TIMESTAMP by CSV auto-detect
    if ((typeName && isDateOnlyArrowType(typeName)) || isMidnightUtc(value)) {
      return formatYmdUtc(value)
    }
    return value.toISOString().replace(/\.\d{3}Z$/, 'Z')
  }
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>)
  }
  if (Array.isArray(value)) return value.map((v) => serializeValue(v, typeName))
  if (typeof value === 'object') {
    const withToJSON = value as { toJSON?: () => unknown }
    if (typeof withToJSON.toJSON === 'function') {
      return serializeValue(withToJSON.toJSON(), typeName)
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
  return field.type != null ? String(field.type) : ''
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

let pendingMemoryLimit = '1GB'

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

async function profileTable(tableName: string): Promise<{ columns: ColumnProfile[]; duplicateCount: number }> {
  const connection = await ensureDb()

  const schemaResult = await connection.query(`DESCRIBE "${tableName}"`)
  const schemaRows = serializeRows(schemaResult)

  const columns: ColumnProfile[] = []

  for (const col of schemaRows) {
    const profile = await profileColumn(tableName, String(col.column_name), String(col.column_type))
    columns.push(profile)
  }

  let duplicateCount = 0
  try {
    const dupResult = await connection.query(`
      SELECT COUNT(*) - (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM "${tableName}")) as dup_count
      FROM "${tableName}"
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
