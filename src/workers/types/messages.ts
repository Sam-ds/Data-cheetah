import type { ColumnSchema, FileFormat } from '@/types/dataset'
import type { ColumnProfile } from '@/types/profile'

export type DuckDBRequest =
  | { id: string; type: 'INIT'; payload?: { memoryLimit?: string } }
  | {
      id: string
      type: 'REGISTER_FILE'
      payload: { name: string; buffer: ArrayBuffer; format: FileFormat; tableName: string }
    }
  | { id: string; type: 'EXECUTE_SQL'; payload: { sql: string; limit?: number } }
  | { id: string; type: 'GET_SCHEMA'; payload: { tableName: string } }
  | { id: string; type: 'GET_PREVIEW'; payload: { tableName: string; limit: number } }
  | { id: string; type: 'PROFILE_TABLE'; payload: { tableName: string } }
  | { id: string; type: 'PROFILE_COLUMN'; payload: { tableName: string; column: string } }
  | { id: string; type: 'DEDUP_STATS'; payload: { tableName: string } }
  | {
      id: string
      type: 'EXPORT_SQL'
      payload: { sql: string; format: 'csv' | 'json' | 'parquet'; fileName?: string }
    }
  | { id: string; type: 'DISPOSE' }

export type DuckDBResponse =
  | { id: string; type: 'READY' }
  | {
      id: string
      type: 'FILE_REGISTERED'
      payload: { tableName: string; schema: ColumnSchema[]; rowCount: number }
    }
  | {
      id: string
      type: 'QUERY_RESULT'
      payload: {
        columns: string[]
        columnTypes: string[]
        rows: Record<string, unknown>[]
        totalRows?: number
        durationMs: number
      }
    }
  | { id: string; type: 'PREVIEW_RESULT'; payload: { rows: Record<string, unknown>[] } }
  | { id: string; type: 'SCHEMA_RESULT'; payload: { schema: ColumnSchema[] } }
  | {
      id: string
      type: 'PROFILE_RESULT'
      payload: { columns: ColumnProfile[]; duplicateCount?: number }
    }
  | {
      id: string
      type: 'DEDUP_STATS_RESULT'
      payload: {
        tableName: string
        totalRows: number
        distinctRows: number
        duplicateRows: number
        columnCount: number
      }
    }
  | {
      id: string
      type: 'EXPORT_RESULT'
      payload: { buffer: ArrayBuffer; fileName: string; mime: string }
    }
  | { id: string; type: 'ERROR'; payload: { message: string } }

export type SqlglotRequest =
  | { id: string; type: 'FORMAT'; payload: { sql: string } }
  | { id: string; type: 'LINT'; payload: { sql: string } }
  | { id: string; type: 'PARSE'; payload: { sql: string } }

export type SqlglotResponse =
  | { id: string; type: 'FORMAT_RESULT'; payload: { sql: string } }
  | {
      id: string
      type: 'LINT_RESULT'
      payload: { valid: boolean; errors: { line: number; column: number; message: string }[] }
    }
  | { id: string; type: 'PARSE_RESULT'; payload: { valid: boolean } }
  | { id: string; type: 'ERROR'; payload: { message: string } }
