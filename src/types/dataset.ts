import type { TableSchemaDoc } from '@/types/schemaDoc'

export type FileFormat = 'csv' | 'parquet' | 'json' | 'xlsx'

export interface ColumnSchema {
  name: string
  type: string
}

export interface RegisteredDataset {
  id: string
  fileName: string
  fileSize: number
  format: FileFormat
  tableName: string
  schema: ColumnSchema[]
  rowCount: number
  registeredAt: Date
  /** Optional LLM-oriented table/column descriptions */
  schemaDoc?: TableSchemaDoc
  /** Set when IndexedDB persist failed but import succeeded */
  persistWarning?: string
}

export interface RecentFileMeta {
  id: string
  fileName: string
  format: FileFormat
  tableName: string
  fileSize: number
  columnCount: number
  rowCount: number
  lastOpenedAt: Date
}
