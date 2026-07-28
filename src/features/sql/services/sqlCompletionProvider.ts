import type { ColumnSchema, RegisteredDataset } from '@/types/dataset'

type Monaco = typeof import('monaco-editor')
type ITextModel = import('monaco-editor').editor.ITextModel
type Position = import('monaco-editor').Position
type IDisposable = import('monaco-editor').IDisposable
type CompletionList = import('monaco-editor').languages.CompletionList
type CompletionItem = import('monaco-editor').languages.CompletionItem

export interface SqlSchemaSnapshot {
  tables: {
    tableName: string
    fileName: string
    columns: ColumnSchema[]
  }[]
}

export function snapshotFromFiles(files: RegisteredDataset[]): SqlSchemaSnapshot {
  return {
    tables: files.map((f) => ({
      tableName: f.tableName,
      fileName: f.fileName,
      columns: f.schema ?? [],
    })),
  }
}

function needsQuote(name: string): boolean {
  return !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
}

function quoteIdent(name: string): string {
  return needsQuote(name) ? `"${name.replace(/"/g, '""')}"` : name
}

const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'FULL JOIN',
  'ON',
  'AS',
  'AND',
  'OR',
  'NOT',
  'IN',
  'LIKE',
  'ILIKE',
  'BETWEEN',
  'IS NULL',
  'IS NOT NULL',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'WITH',
  'UNION',
  'UNION ALL',
  'CAST',
  'TRY_CAST',
  'COALESCE',
  'NULLIF',
  'EXTRACT',
  'DATE',
  'TRUE',
  'FALSE',
  'ASC',
  'DESC',
]

function wordRange(model: ITextModel, position: Position) {
  const word = model.getWordUntilPosition(position)
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  }
}

/** Text before cursor on the current line (and previous line for FROM/JOIN wraps). */
function prefixContext(model: ITextModel, position: Position): string {
  const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
  if (position.lineNumber === 1) return line
  const prev = model.getLineContent(position.lineNumber - 1)
  return `${prev} ${line}`
}

function tableBeforeDot(textBefore: string): string | null {
  const m = textBefore.match(/(?:("([^"]+)")|([A-Za-z_][\w]*))\s*\.\s*$/)
  if (!m) return null
  return m[2] ?? m[3] ?? null
}

function wantsTableSuggestion(textBefore: string): boolean {
  return /\b(from|join|update|into|table)\s+("?[A-Za-z_][\w]*"?|"[^"]*)?$/i.test(
    textBefore.trimEnd(),
  )
}

/**
 * Monaco completion for DuckDB SQL using currently loaded Explore datasets.
 * getSchema is read on each keystroke so new files appear without re-registering.
 */
export function registerSqlCompletionProvider(
  monaco: Monaco,
  getSchema: () => SqlSchemaSnapshot,
): IDisposable {
  return monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: [' ', '.', '"', '_', ','],
    provideCompletionItems(model, position): CompletionList {
      const range = wordRange(model, position)
      const before = prefixContext(model, position)
      const schema = getSchema()
      const Kind = monaco.languages.CompletionItemKind

      const suggestions: CompletionItem[] = []
      const seen = new Set<string>()

      const push = (
        label: string,
        insertText: string,
        kind: CompletionItem['kind'],
        detail?: string,
        sortText?: string,
      ) => {
        const key = `${String(kind)}:${insertText}`
        if (seen.has(key)) return
        seen.add(key)
        suggestions.push({
          label,
          kind,
          insertText,
          detail,
          range,
          sortText,
        })
      }

      const dotted = tableBeforeDot(before)
      if (dotted) {
        const table =
          schema.tables.find((t) => t.tableName.toLowerCase() === dotted.toLowerCase()) ??
          schema.tables.find((t) => t.tableName === dotted)
        const cols = table?.columns?.length
          ? table.columns
          : schema.tables.flatMap((t) => t.columns)
        for (const col of cols) {
          push(col.name, quoteIdent(col.name), Kind.Field, col.type || 'column', `0_${col.name}`)
        }
        return { suggestions }
      }

      const preferTables = wantsTableSuggestion(before)

      for (const table of schema.tables) {
        push(
          table.tableName,
          quoteIdent(table.tableName),
          Kind.Class,
          table.fileName || 'table',
          preferTables ? `0_${table.tableName}` : `1_${table.tableName}`,
        )
      }

      if (!preferTables) {
        for (const table of schema.tables) {
          for (const col of table.columns) {
            push(
              col.name,
              quoteIdent(col.name),
              Kind.Field,
              `${table.tableName} · ${col.type || 'column'}`,
              `2_${table.tableName}_${col.name}`,
            )
          }
        }
      }

      for (const kw of SQL_KEYWORDS) {
        push(kw, kw, Kind.Keyword, 'SQL', `9_${kw}`)
      }

      return { suggestions }
    },
  })
}
