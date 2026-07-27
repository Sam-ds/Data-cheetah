import type { ColumnSchema, RegisteredDataset } from '@/types/dataset'
import type { TableSchemaDoc } from '@/types/schemaDoc'
import { duckdbClient } from '@/services/duckdbClient'
import { formatSchemaDocForPrompt } from '@/features/files/services/schemaDocService'

export interface FileContextBlock {
  fileId: string
  fileName: string
  tableName: string
  rowCount: number
  columns: ColumnSchema[]
  sampleRows: Record<string, unknown>[]
  schemaDoc?: TableSchemaDoc
  schemaDocText?: string
}

function truncateCell(value: unknown, max = 80): unknown {
  if (typeof value === 'string' && value.length > max) {
    return `${value.slice(0, max)}…`
  }
  return value
}

function truncateRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      next[k] = truncateCell(v)
    }
    return next
  })
}

/** Reuse loaded schema + Explorer-style preview — no LLM schema inference. */
export async function buildFileContexts(
  files: RegisteredDataset[],
  selectedFileIds: string[],
): Promise<FileContextBlock[]> {
  const selected = files.filter((f) => selectedFileIds.includes(f.id))
  if (selected.length === 0) {
    throw new Error('Select at least one file.')
  }

  const blocks: FileContextBlock[] = []
  for (const file of selected) {
    let columns = file.schema
    if (!columns.length) {
      columns = await duckdbClient.getSchema(file.tableName)
    }
    const sampleRows = truncateRows(await duckdbClient.getPreview(file.tableName, 2))
    const schemaDocText = formatSchemaDocForPrompt(file.schemaDoc)
    blocks.push({
      fileId: file.id,
      fileName: file.fileName,
      tableName: file.tableName,
      rowCount: file.rowCount,
      columns,
      sampleRows,
      schemaDoc: file.schemaDoc,
      schemaDocText: schemaDocText || undefined,
    })
  }
  return blocks
}

export function formatTableContextForPrompt(c: FileContextBlock): string {
  const cols = c.columns
    .map((col) => {
      const meaning = c.schemaDoc?.columns?.[col.name]
      const extra = meaning
        ? ` — ${meaning.description}${meaning.role ? ` [${meaning.role}]` : ''}${
            meaning.unit ? ` (${meaning.unit})` : ''
          }`
        : ''
      return `  - ${col.name}: ${col.type}${extra}`
    })
    .join('\n')
  const sample = JSON.stringify(c.sampleRows, null, 2)
  const header = [
    `Table "${c.tableName}" (${c.fileName}, ~${c.rowCount} rows)`,
    c.schemaDoc?.description ? `Description: ${c.schemaDoc.description}` : null,
    c.schemaDoc?.grain ? `Grain: ${c.schemaDoc.grain}` : null,
    c.schemaDoc?.notes ? `Notes: ${c.schemaDoc.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const relationships =
    c.schemaDoc?.relationships?.length &&
    `Relationships:\n${c.schemaDoc.relationships
      .map(
        (r) =>
          `  - ${r.from} → ${r.toTable}.${r.toColumn}${r.type ? ` (${r.type})` : ''}${
            r.description ? `: ${r.description}` : ''
          }`,
      )
      .join('\n')}`

  return [header, `Columns:\n${cols}`, relationships, `Sample rows:\n${sample}`]
    .filter(Boolean)
    .join('\n')
}
