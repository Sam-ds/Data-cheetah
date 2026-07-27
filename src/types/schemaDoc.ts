/** Optional human/LLM-oriented descriptions for a loaded table. */

export type ColumnRole =
  | 'id'
  | 'fk'
  | 'metric'
  | 'dimension'
  | 'date'
  | 'timestamp'
  | 'text'
  | 'flag'
  | 'other'

export interface ColumnSchemaDoc {
  description: string
  role?: ColumnRole | string
  unit?: string | null
  synonyms?: string[]
  /** e.g. "books.book_id" */
  references?: string
  /** Allowed / example values when helpful */
  examples?: string[]
}

export interface TableRelationshipDoc {
  from: string
  toTable: string
  toColumn: string
  type?: 'many_to_one' | 'one_to_many' | 'one_to_one' | string
  description?: string
}

export interface TableSchemaDoc {
  /** Must match DuckDB table name (sanitized file stem), e.g. "orders" */
  table: string
  description?: string
  /** What one row represents */
  grain?: string
  notes?: string
  columns?: Record<string, ColumnSchemaDoc>
  relationships?: TableRelationshipDoc[]
  exampleQuestions?: string[]
  sourceFileName?: string
}

export interface SchemaDocFile {
  version?: number | string
  /** Single-table doc (or use tables[]) */
  table?: string
  description?: string
  grain?: string
  notes?: string
  columns?: Record<string, ColumnSchemaDoc>
  relationships?: TableRelationshipDoc[]
  exampleQuestions?: string[]
  /** Multi-table bundle */
  tables?: TableSchemaDoc[]
}
