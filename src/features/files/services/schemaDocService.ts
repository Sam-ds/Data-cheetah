import type {
  ColumnSchemaDoc,
  SchemaDocFile,
  TableRelationshipDoc,
  TableSchemaDoc,
} from '@/types/schemaDoc'
import { sanitizeTableName } from '@/lib/utils/sanitizeTableName'

export const SCHEMA_DOC_TEMPLATE: SchemaDocFile = {
  version: 1,
  table: 'orders',
  description: 'Customer purchase orders from the online bookstore.',
  grain: 'One row per order line item',
  notes:
    'Amounts are in USD. Use single quotes for string filters. Join to books via book_id. The DuckDB table name must match "table" exactly.',
  columns: {
    order_id: {
      description: 'Unique id for the order line',
      role: 'id',
      synonyms: ['id', 'order number'],
    },
    book_id: {
      description: 'Foreign key to the books table',
      role: 'fk',
      references: 'books.book_id',
    },
    order_date: {
      description: 'Calendar date the order was placed (DATE, not year integer)',
      role: 'date',
      examples: ['2020-01-15'],
    },
    price: {
      description: 'Line-item price paid by the customer',
      role: 'metric',
      unit: 'USD',
    },
    status: {
      description: 'Order lifecycle status',
      role: 'dimension',
      examples: ['pending', 'shipped', 'cancelled'],
    },
  },
  relationships: [
    {
      from: 'book_id',
      toTable: 'books',
      toColumn: 'book_id',
      type: 'many_to_one',
      description: 'Each order line references one book',
    },
  ],
  exampleQuestions: [
    'Average price of orders for Harry Potter books',
    'Orders per month in 2020',
  ],
}

export function isSchemaDocFileName(fileName: string): boolean {
  return /\.schema\.json$/i.test(fileName) || /[-_.]schema\.json$/i.test(fileName)
}

function asColumnDoc(value: unknown): ColumnSchemaDoc | null {
  if (!value || typeof value !== 'object') return null
  const rec = value as Record<string, unknown>
  const description = String(rec.description ?? '').trim()
  if (!description) return null
  const doc: ColumnSchemaDoc = { description }
  if (rec.role != null) doc.role = String(rec.role)
  if (rec.unit !== undefined) doc.unit = rec.unit == null ? null : String(rec.unit)
  if (Array.isArray(rec.synonyms)) doc.synonyms = rec.synonyms.map(String)
  if (rec.references != null) doc.references = String(rec.references)
  if (Array.isArray(rec.examples)) doc.examples = rec.examples.map(String)
  return doc
}

function asRelationship(value: unknown): TableRelationshipDoc | null {
  if (!value || typeof value !== 'object') return null
  const rec = value as Record<string, unknown>
  const from = String(rec.from ?? '').trim()
  const toTable = String(rec.toTable ?? '').trim()
  const toColumn = String(rec.toColumn ?? '').trim()
  if (!from || !toTable || !toColumn) return null
  const rel: TableRelationshipDoc = { from, toTable, toColumn }
  if (rec.type != null) rel.type = String(rec.type)
  if (rec.description != null) rel.description = String(rec.description)
  return rel
}

function normalizeTableDoc(raw: Record<string, unknown>, sourceFileName?: string): TableSchemaDoc {
  const tableRaw = String(raw.table ?? '').trim()
  const table = tableRaw ? sanitizeTableName(tableRaw) || tableRaw : ''
  if (!table) {
    throw new Error('Schema doc is missing a "table" name.')
  }

  const columns: Record<string, ColumnSchemaDoc> = {}
  if (raw.columns && typeof raw.columns === 'object' && !Array.isArray(raw.columns)) {
    for (const [name, value] of Object.entries(raw.columns as Record<string, unknown>)) {
      const col = asColumnDoc(value)
      if (col) columns[name] = col
    }
  } else if (Array.isArray(raw.columns)) {
    for (const item of raw.columns) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const name = String(rec.name ?? '').trim()
      const col = asColumnDoc(rec)
      if (name && col) columns[name] = col
    }
  }

  const relationships = Array.isArray(raw.relationships)
    ? raw.relationships.map(asRelationship).filter((r): r is TableRelationshipDoc => Boolean(r))
    : undefined

  const doc: TableSchemaDoc = { table }
  if (raw.description != null) doc.description = String(raw.description)
  if (raw.grain != null) doc.grain = String(raw.grain)
  if (raw.notes != null) doc.notes = String(raw.notes)
  if (Object.keys(columns).length) doc.columns = columns
  if (relationships?.length) doc.relationships = relationships
  if (Array.isArray(raw.exampleQuestions)) {
    doc.exampleQuestions = raw.exampleQuestions.map(String).filter(Boolean)
  }
  if (sourceFileName) doc.sourceFileName = sourceFileName
  return doc
}

/** Parse one or more table schema docs from JSON text. */
export function parseSchemaDocFile(text: string, sourceFileName?: string): TableSchemaDoc[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Schema description must be valid JSON.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Schema description JSON must be an object.')
  }

  const root = parsed as SchemaDocFile & Record<string, unknown>

  if (Array.isArray(root.tables)) {
    return root.tables.map((t) =>
      normalizeTableDoc(t as unknown as Record<string, unknown>, sourceFileName),
    )
  }

  // Infer table name from file stem: orders.schema.json → orders
  if (!root.table && sourceFileName) {
    const stem = sourceFileName.replace(/\.schema\.json$/i, '').replace(/[-_.]schema$/i, '')
    root.table = sanitizeTableName(stem) || stem
  }

  return [normalizeTableDoc(root, sourceFileName)]
}

export async function readSchemaDocFromFile(file: File): Promise<TableSchemaDoc[]> {
  const text = await file.text()
  return parseSchemaDocFile(text, file.name)
}

export function formatSchemaDocForPrompt(doc: TableSchemaDoc | undefined): string {
  if (!doc) return ''
  const lines: string[] = []
  if (doc.description) lines.push(`Description: ${doc.description}`)
  if (doc.grain) lines.push(`Grain: ${doc.grain}`)
  if (doc.notes) lines.push(`Notes: ${doc.notes}`)
  if (doc.columns && Object.keys(doc.columns).length) {
    lines.push('Column meanings:')
    for (const [name, col] of Object.entries(doc.columns)) {
      const bits = [col.description]
      if (col.role) bits.push(`role=${col.role}`)
      if (col.unit) bits.push(`unit=${col.unit}`)
      if (col.references) bits.push(`ref=${col.references}`)
      if (col.synonyms?.length) bits.push(`aka=${col.synonyms.join('|')}`)
      if (col.examples?.length) bits.push(`examples=${col.examples.join('|')}`)
      lines.push(`  - ${name}: ${bits.join('; ')}`)
    }
  }
  if (doc.relationships?.length) {
    lines.push('Relationships:')
    for (const rel of doc.relationships) {
      lines.push(
        `  - ${rel.from} → ${rel.toTable}.${rel.toColumn}${rel.type ? ` (${rel.type})` : ''}${
          rel.description ? `: ${rel.description}` : ''
        }`,
      )
    }
  }
  if (doc.exampleQuestions?.length) {
    lines.push(`Example questions: ${doc.exampleQuestions.join(' | ')}`)
  }
  return lines.join('\n')
}

export function downloadSchemaDocTemplate(fileName = 'table.schema.json'): void {
  const blob = new Blob([JSON.stringify(SCHEMA_DOC_TEMPLATE, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Build one fill-in JSON covering every loaded table + column.
 * Pre-fills names/types from DuckDB; leaves description fields blank (or keeps existing docs).
 */
export function buildWorkspaceSchemaDocDraft(
  files: { tableName: string; fileName: string; schema: { name: string; type: string }[]; schemaDoc?: TableSchemaDoc }[],
): SchemaDocFile {
  const tables: TableSchemaDoc[] = files.map((file) => {
    const existing = file.schemaDoc
    const columns: Record<string, ColumnSchemaDoc> = {}
    for (const col of file.schema) {
      const prev = existing?.columns?.[col.name]
      columns[col.name] = {
        description: prev?.description ?? '',
        role: prev?.role ?? guessRole(col.name, col.type),
        ...(prev?.unit !== undefined ? { unit: prev.unit } : {}),
        ...(prev?.synonyms?.length ? { synonyms: prev.synonyms } : {}),
        ...(prev?.references ? { references: prev.references } : {}),
        ...(prev?.examples?.length ? { examples: prev.examples } : {}),
      }
    }
    return {
      table: file.tableName,
      description: existing?.description ?? '',
      grain: existing?.grain ?? '',
      notes: existing?.notes ?? `Source file: ${file.fileName}`,
      columns,
      relationships: existing?.relationships ?? [],
      exampleQuestions: existing?.exampleQuestions ?? [],
    }
  })

  return {
    version: 1,
    tables,
  }
}

function guessRole(name: string, type: string): string {
  const n = name.toLowerCase()
  const t = type.toLowerCase()
  if (/\b(date|timestamp)\b/.test(t) || /(^|_)(date|time|at|dob)(_|$)/.test(n)) return 'date'
  if (/(^|_)(id|pk)(_|$)/.test(n) || n.endsWith('_id')) return n.endsWith('_id') && n !== 'id' ? 'fk' : 'id'
  if (/\b(double|float|decimal|int|bigint|hugeint|numeric)\b/.test(t)) return 'metric'
  if (/\b(bool|boolean)\b/.test(t) || /^(is_|has_)/.test(n)) return 'flag'
  if (/\b(varchar|text|string|char)\b/.test(t)) return 'dimension'
  return 'other'
}

/** Download a single schema file with all loaded tables ready to fill in. */
export function downloadWorkspaceSchemaDocDraft(
  files: { tableName: string; fileName: string; schema: { name: string; type: string }[]; schemaDoc?: TableSchemaDoc }[],
  fileName = 'datacheetah.schema.json',
): void {
  if (files.length === 0) {
    throw new Error('Load at least one data table first.')
  }
  const draft = buildWorkspaceSchemaDocDraft(files)
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** Match a schema doc to a loaded DuckDB table name. */
export function findTableForSchemaDoc(
  doc: TableSchemaDoc,
  tableNames: string[],
): string | null {
  const target = doc.table.toLowerCase()
  const exact = tableNames.find((t) => t.toLowerCase() === target)
  if (exact) return exact
  // Soft match: doc "orders" vs table "order" / "orders_csv"
  const soft = tableNames.find(
    (t) => t.toLowerCase().includes(target) || target.includes(t.toLowerCase()),
  )
  return soft ?? null
}
