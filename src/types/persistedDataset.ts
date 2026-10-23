import type { ColumnSchema, FileFormat } from '@/types/dataset'
import type { DatasetCryptoMeta } from '@/types/originVault'
import type { TableSchemaDoc } from '@/types/schemaDoc'

/** Persisted dataset bytes + meta for restore across refresh (IndexedDB). */
export interface PersistedDataset {
  id: string
  /** Local workspace this dataset belongs to */
  workspaceId: string
  fileName: string
  /** Name used with DuckDB registerFileBuffer (may differ after XLSX/JSON normalize) */
  registerName: string
  format: FileFormat
  tableName: string
  schema: ColumnSchema[]
  rowCount: number
  fileSize: number
  /** Ciphertext when `crypto` is set; legacy plaintext otherwise. */
  buffer: ArrayBuffer
  /** Present when `buffer` is AES-GCM ciphertext. */
  crypto?: DatasetCryptoMeta
  schemaDoc?: TableSchemaDoc
  savedAt: Date
}
