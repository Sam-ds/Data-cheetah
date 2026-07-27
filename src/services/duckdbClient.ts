import type { DuckDBRequest, DuckDBResponse, SqlglotRequest, SqlglotResponse } from '@/workers/types/messages'
import type { ColumnSchema, FileFormat } from '@/types/dataset'
import type { ColumnProfile } from '@/types/profile'
import type { QueryResult, SqlDiagnostic } from '@/types/query'
// ?worker forces Vite to emit compiled .js (GitHub Pages rejects .ts as video/mp2t)
import DuckDBWorker from '../workers/duckdb.worker.ts?worker'
import SqlglotWorker from '../workers/sqlglot.worker.ts?worker'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

function createWorkerBridge(createWorker: () => Worker) {
  let worker: Worker | null = null
  const pending = new Map<string, PendingRequest>()

  function ensureWorker(): Worker {
    if (!worker) {
      worker = createWorker()
      worker.onmessage = (event: MessageEvent<{ id: string; type: string; payload?: { message: string } }>) => {
        const response = event.data
        const req = pending.get(response.id)
        if (!req) return
        pending.delete(response.id)
        if (response.type === 'ERROR') {
          req.reject(new Error(response.payload?.message ?? 'Worker error'))
        } else {
          req.resolve(response)
        }
      }
      worker.onerror = (error) => {
        for (const [, req] of pending) req.reject(new Error(error.message))
        pending.clear()
      }
    }
    return worker
  }

  return {
    send<T extends { id: string }>(request: T): Promise<T> {
      return new Promise((resolve, reject) => {
        pending.set(request.id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        })
        ensureWorker().postMessage(request)
      })
    },
    dispose() {
      worker?.terminate()
      worker = null
      pending.clear()
    },
  }
}

const duckdbBridge = createWorkerBridge(() => new DuckDBWorker())
const sqlglotBridge = createWorkerBridge(() => new SqlglotWorker())

async function duckdbRequest(req: Omit<DuckDBRequest, 'id'>): Promise<DuckDBResponse> {
  return duckdbBridge.send({ ...req, id: crypto.randomUUID() } as DuckDBRequest) as unknown as Promise<DuckDBResponse>
}

async function sqlglotRequest(req: Omit<SqlglotRequest, 'id'>): Promise<SqlglotResponse> {
  return sqlglotBridge.send({ ...req, id: crypto.randomUUID() } as SqlglotRequest) as unknown as Promise<SqlglotResponse>
}

let duckdbInitPromise: Promise<void> | null = null
let duckdbReady = false

async function ensureDuckDBInit(): Promise<void> {
  if (duckdbInitPromise) return duckdbInitPromise
  duckdbInitPromise = (async () => {
    await duckdbRequest({ type: 'INIT' })
    duckdbReady = true
  })()
  return duckdbInitPromise
}

export const duckdbClient = {
  async init() {
    return ensureDuckDBInit()
  },

  isReady() {
    return duckdbReady
  },

  async registerFile(
    name: string,
    buffer: ArrayBuffer,
    format: FileFormat,
    tableName: string,
  ): Promise<{ tableName: string; schema: ColumnSchema[]; rowCount: number }> {
    await ensureDuckDBInit()
    const response = await duckdbRequest({
      type: 'REGISTER_FILE',
      payload: { name, buffer, format, tableName },
    } as Omit<Extract<DuckDBRequest, { type: 'REGISTER_FILE' }>, 'id'>)
    if (response.type === 'FILE_REGISTERED') {
      return response.payload
    }
    throw new Error('Unexpected response')
  },

  async executeSql(sql: string, limit?: number): Promise<QueryResult> {
    await ensureDuckDBInit()
    const response = await duckdbRequest({
      type: 'EXECUTE_SQL',
      payload: { sql, limit },
    } as Omit<Extract<DuckDBRequest, { type: 'EXECUTE_SQL' }>, 'id'>)
    if (response.type === 'QUERY_RESULT') {
      return response.payload
    }
    throw new Error('Unexpected response')
  },

  async getPreview(tableName: string, limit = 100): Promise<Record<string, unknown>[]> {
    await ensureDuckDBInit()
    const response = await duckdbRequest({
      type: 'GET_PREVIEW',
      payload: { tableName, limit },
    } as Omit<Extract<DuckDBRequest, { type: 'GET_PREVIEW' }>, 'id'>)
    if (response.type === 'PREVIEW_RESULT') {
      return response.payload.rows
    }
    throw new Error('Unexpected response')
  },

  async getSchema(tableName: string): Promise<ColumnSchema[]> {
    await ensureDuckDBInit()
    const response = await duckdbRequest({
      type: 'GET_SCHEMA',
      payload: { tableName },
    } as Omit<Extract<DuckDBRequest, { type: 'GET_SCHEMA' }>, 'id'>)
    if (response.type === 'SCHEMA_RESULT') {
      return response.payload.schema
    }
    throw new Error('Unexpected response')
  },

  async profileTable(tableName: string): Promise<{ columns: ColumnProfile[]; duplicateCount: number }> {
    await ensureDuckDBInit()
    const response = await duckdbRequest({
      type: 'PROFILE_TABLE',
      payload: { tableName },
    } as Omit<Extract<DuckDBRequest, { type: 'PROFILE_TABLE' }>, 'id'>)
    if (response.type === 'PROFILE_RESULT') {
      return {
        columns: response.payload.columns,
        duplicateCount: response.payload.duplicateCount ?? 0,
      }
    }
    throw new Error('Unexpected response')
  },

  dispose() {
    duckdbBridge.dispose()
    duckdbInitPromise = null
    duckdbReady = false
  },
}

export const sqlglotClient = {
  async formatSql(sql: string): Promise<string> {
    const response = await sqlglotRequest({ type: 'FORMAT', payload: { sql } })
    if (response.type === 'FORMAT_RESULT') {
      return response.payload.sql
    }
    throw new Error('Unexpected response')
  },

  async lintSql(sql: string): Promise<{ valid: boolean; diagnostics: SqlDiagnostic[] }> {
    const response = await sqlglotRequest({ type: 'LINT', payload: { sql } })
    if (response.type === 'LINT_RESULT') {
      return {
        valid: response.payload.valid,
        diagnostics: response.payload.errors.map((e) => ({
          ...e,
          severity: 'error' as const,
        })),
      }
    }
    throw new Error('Unexpected response')
  },
}
