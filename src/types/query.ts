export interface QueryResult {
  columns: string[]
  columnTypes: string[]
  rows: Record<string, unknown>[]
  totalRows?: number
  durationMs: number
}

export interface SqlDiagnostic {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning'
}

export interface SavedQuery {
  id: string
  name: string
  sql: string
  tableName: string
  createdAt: Date
  updatedAt: Date
}

export type SqlDialect = 'duckdb' | 'bigquery' | 'snowflake' | 'spark' | 'trino' | 'postgres' | 'mysql'
