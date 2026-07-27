import { duckdbClient } from '@/services/duckdbClient'
import type { QueryResult } from '@/types/query'
import type { AskAnswer, LlmProvider } from '../llm/types'
import { buildAnswerPrompt, buildSqlForQuestionPrompt } from '../prompts/askPrompts'
import type { FileContextBlock } from './contextBuilder'
import {
  applyCatalogDidYouMean,
  applyDateBinderRepair,
  collectDateColumnNames,
  collectSqlIdentifiers,
  collectTableNames,
  extractSqlFromModel,
  repairDateIntegerComparisons,
  repairDuckdbStringQuotes,
  repairUnknownTableNames,
  scrubSqlExtractionJunk,
} from './sqlGuard'

const RESULT_CAP = 20
const ASK_ROW_LIMIT_FLOOR = 500

function normalizeResultColumns(
  columns: string[],
  rows: Record<string, unknown>[],
): string[] {
  if (columns.length > 0) return columns
  if (rows[0]) return Object.keys(rows[0])
  return []
}

/** True when DuckDB gave nothing usable to answer from (no rows, or only nulls). */
export function isUnusableResult(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return true
  return rows.every((row) => {
    const values = Object.values(row)
    if (values.length === 0) return true
    return values.every((v) => v == null)
  })
}

function emptyResultAnswer(question: string): string {
  return (
    `No answer from the data for: “${question}”. ` +
    `The SQL ran successfully but returned no rows (or only null values), so nothing was invented. ` +
    `Try a broader question, or inspect/edit the SQL below.`
  )
}

function formatCell(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000)
  }
  return String(value)
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return null
}

function isComparisonQuestion(question: string): boolean {
  return /\b(which|who|what)\b/i.test(question) &&
    /\b(more|most|least|fewer|greater|higher|lower|largest|smallest|top|best|worst|max|min)\b/i.test(
      question,
    )
}

function isAscendingComparison(question: string): boolean {
  return /\b(least|fewer|lower|smallest|worst|min)\b/i.test(question)
}

/**
 * For “which has more …” style questions over a label + metric breakdown,
 * answer with the winning label instead of dumping every row.
 */
function tryComparisonAnswer(
  question: string,
  columns: string[],
  rows: Record<string, unknown>[],
): string | null {
  if (!isComparisonQuestion(question) || rows.length < 2 || columns.length < 2) return null

  const numericCols = columns.filter((col) =>
    rows.every((row) => row[col] == null || asFiniteNumber(row[col]) != null),
  )
  const labelCols = columns.filter((col) => !numericCols.includes(col))
  if (numericCols.length === 0 || labelCols.length === 0) return null

  const metricCol =
    numericCols.find((col) => /count|total|sum|amount|qty|quantity|num|score|value/i.test(col)) ??
    numericCols[numericCols.length - 1]!
  const labelCol = labelCols[0]!
  const ascending = isAscendingComparison(question)

  let best = rows[0]!
  let bestMetric = asFiniteNumber(best[metricCol])
  if (bestMetric == null) return null

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!
    const metric = asFiniteNumber(row[metricCol])
    if (metric == null) continue
    if (ascending ? metric < bestMetric : metric > bestMetric) {
      best = row
      bestMetric = metric
    }
  }

  const winner = formatCell(best[labelCol])
  const others = rows
    .filter((row) => row !== best)
    .map((row) => `${formatCell(row[labelCol])} (${formatCell(row[metricCol])})`)
    .slice(0, 3)

  if (others.length === 1) {
    return `${winner} has the ${ascending ? 'lower' : 'higher'} ${metricCol} (${formatCell(best[metricCol])}) vs ${others[0]}.`
  }
  if (others.length > 1) {
    return `${winner} leads with ${metricCol}=${formatCell(best[metricCol])} (ahead of ${others.join(', ')}).`
  }
  return `${winner} (${metricCol}=${formatCell(best[metricCol])}).`
}

/**
 * Prefer a deterministic one-liner for tiny result sets so the model cannot invent figures.
 * Falls back to null → caller may use the LLM for richer multi-row summaries.
 */
export function tryDeterministicAnswer(
  question: string,
  columns: string[],
  rows: Record<string, unknown>[],
): string | null {
  if (isUnusableResult(rows)) return emptyResultAnswer(question)

  if (rows.length === 1 && columns.length === 1) {
    const col = columns[0]
    return `Result for “${question}”: ${formatCell(rows[0][col])} (${col}).`
  }

  if (rows.length === 1 && columns.length <= 4) {
    const parts = columns.map((c) => `${c}=${formatCell(rows[0][c])}`)
    return `Result for “${question}”: ${parts.join(', ')}.`
  }

  const comparison = tryComparisonAnswer(question, columns, rows)
  if (comparison) return comparison

  if (rows.length <= 8 && columns.length <= 4) {
    const lines = rows.map((row, i) => {
      const parts = columns.map((c) => `${c}=${formatCell(row[c])}`)
      return `${i + 1}. ${parts.join(', ')}`
    })
    return `Results for “${question}” (${rows.length} rows):\n${lines.join('\n')}`
  }

  return null
}

function prepareSql(
  sql: string,
  knownIds: string[],
  tableNames: string[],
  dateColumns: string[],
): string {
  const withTables = repairUnknownTableNames(sql, tableNames)
  const withDates = repairDateIntegerComparisons(withTables, dateColumns)
  const quoted = repairDuckdbStringQuotes(withDates, [...knownIds, ...tableNames, ...dateColumns])
  return scrubSqlExtractionJunk(quoted)
}

async function runSql(
  sql: string,
  limit: number,
  knownIds: string[],
  tableNames: string[],
  dateColumns: string[],
): Promise<{ sql: string; result: QueryResult }> {
  const repaired = prepareSql(sql, knownIds, tableNames, dateColumns)
  const result = await duckdbClient.executeSql(repaired, limit)
  return { sql: repaired, result }
}

async function rewriteSqlAfterError(
  provider: LlmProvider,
  contexts: FileContextBlock[],
  question: string,
  badSql: string,
  errorMessage: string,
  onStatus?: (text: string) => void,
): Promise<string> {
  onStatus?.('Fixing SQL after DuckDB error…')
  const allowedTables = contexts.map((c) => `"${c.tableName}"`).join(', ')
  const tables = contexts
    .map((c) => `"${c.tableName}" (${c.columns.map((col) => `${col.name}:${col.type}`).join(', ')})`)
    .join('\n')
  const raw = await provider.complete(
    [
      {
        role: 'system',
        content: `Fix the DuckDB SQL. Return ONLY JSON: {"sql":"SELECT ..."}.
Rules:
- Use ONLY these exact table names: ${allowedTables}
- String literals use single quotes: country = 'US' (never "US")
- Identifiers use double quotes only for table/column names
- One read-only SELECT or WITH ... SELECT
- Never compare DATE/TIMESTAMP to an integer year — use DATE '1984-01-01' or EXTRACT(year FROM col) = 1984
- Prefer simple filters: lat = 1.2 AND lon = 3.4 (not row IN tuples)`,
      },
      {
        role: 'user',
        content: `ALLOWED TABLES: ${allowedTables}\n\nTables:\n${tables}\n\nQuestion: ${question}\n\nBroken SQL:\n${badSql}\n\nDuckDB error:\n${errorMessage}\n\nReturn corrected {"sql":"..."}.`,
      },
    ],
    {
      temperature: 0,
      onChunk: (t) => onStatus?.(`Fixing SQL… ${t.length} chars`),
    },
  )
  return extractSqlFromModel(raw)
}

export async function answerQuestion(
  provider: LlmProvider,
  contexts: FileContextBlock[],
  questionId: string,
  question: string,
  rowLimit = 10000,
  onStatus?: (text: string) => void,
): Promise<AskAnswer> {
  const effectiveLimit = Math.max(rowLimit || 0, ASK_ROW_LIMIT_FLOOR)
  const knownIds = collectSqlIdentifiers(contexts)
  const tableNames = collectTableNames(contexts)
  const dateColumns = collectDateColumnNames(contexts)

  const sqlPrompt = buildSqlForQuestionPrompt(contexts, question)
  onStatus?.('Model is writing SQL…')
  const sqlRaw = await provider.complete(
    [
      { role: 'system', content: sqlPrompt.system },
      { role: 'user', content: sqlPrompt.user },
    ],
    {
      temperature: 0.1,
      onChunk: (t) => onStatus?.(`Writing SQL… ${t.length} chars`),
    },
  )

  let sql = prepareSql(extractSqlFromModel(sqlRaw), knownIds, tableNames, dateColumns)
  let result: QueryResult | null = null
  let lastError: string | null = null

  onStatus?.('Running SQL in DuckDB…')
  try {
    const ran = await runSql(sql, effectiveLimit, knownIds, tableNames, dateColumns)
    sql = ran.sql
    result = ran.result
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
  }

  // Fast path: DuckDB "Did you mean …?"
  if (!result && lastError) {
    const hinted = applyCatalogDidYouMean(sql, lastError)
    if (hinted) {
      try {
        onStatus?.('Applying table-name hint from DuckDB…')
        const ran = await runSql(hinted, effectiveLimit, knownIds, tableNames, dateColumns)
        sql = ran.sql
        result = ran.result
        lastError = null
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
      }
    }
  }

  // Fast path: DATE vs integer year binder errors
  if (!result && lastError) {
    const dateFixed = applyDateBinderRepair(sql, lastError, dateColumns)
    if (dateFixed) {
      try {
        onStatus?.('Fixing DATE vs integer comparison…')
        const ran = await runSql(dateFixed, effectiveLimit, knownIds, tableNames, dateColumns)
        sql = ran.sql
        result = ran.result
        lastError = null
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
      }
    }
  }

  // Model rewrite using the binder/catalog error
  if (!result && lastError) {
    try {
      const fixed = await rewriteSqlAfterError(
        provider,
        contexts,
        question,
        sql,
        lastError,
        onStatus,
      )
      const ran = await runSql(fixed, effectiveLimit, knownIds, tableNames, dateColumns)
      sql = ran.sql
      result = ran.result
      lastError = null
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  if (!result) {
    return {
      questionId,
      sql,
      answer: '',
      rowCount: 0,
      previewRows: [],
      columns: [],
      error:
        lastError ??
        'DuckDB could not run the generated SQL. Try another question or inspect the SQL.',
    }
  }

  // One retry with a simpler prompt if the first query returned nothing usable
  if (isUnusableResult(result.rows)) {
    onStatus?.('No usable rows — asking model for a simpler query…')
    const allowedTables = contexts.map((c) => `"${c.tableName}"`).join(', ')
    const retryRaw = await provider.complete(
      [
        {
          role: 'system',
          content: `The previous DuckDB SQL returned no usable rows. Write a simpler read-only SELECT that answers the question using ONLY these exact tables: ${allowedTables}.
Return ONLY JSON: {"sql":"SELECT ..."}.
String literals: single quotes ('US'). Dates: DATE 'YYYY-MM-DD' or EXTRACT(year FROM col). Prefer COUNT(*) / GROUP BY. LIMIT 100.`,
        },
        {
          role: 'user',
          content: `ALLOWED TABLES: ${allowedTables}\n\nTables:\n${contexts
            .map((c) => `"${c.tableName}" cols: ${c.columns.map((col) => `${col.name}:${col.type}`).join(', ')}`)
            .join('\n')}\n\nQuestion: ${question}\n\nPrevious SQL (empty/null):\n${sql}`,
        },
      ],
      {
        temperature: 0.1,
        onChunk: (t) => onStatus?.(`Retrying SQL… ${t.length} chars`),
      },
    )
    try {
      const retrySql = prepareSql(extractSqlFromModel(retryRaw), knownIds, tableNames, dateColumns)
      if (retrySql !== sql) {
        const ran = await runSql(retrySql, effectiveLimit, knownIds, tableNames, dateColumns)
        if (!isUnusableResult(ran.result.rows)) {
          sql = ran.sql
          result = ran.result
        }
      }
    } catch {
      /* keep original empty result */
    }
  }

  return finishAnswer(provider, questionId, question, sql, result, onStatus)
}

async function finishAnswer(
  provider: LlmProvider,
  questionId: string,
  question: string,
  sql: string,
  result: { columns: string[]; rows: Record<string, unknown>[] },
  onStatus?: (text: string) => void,
): Promise<AskAnswer> {
  const columns = normalizeResultColumns(result.columns, result.rows)
  const previewRows = result.rows.slice(0, RESULT_CAP)
  const unusable = isUnusableResult(result.rows)

  if (unusable) {
    onStatus?.('No data to summarize')
    return {
      questionId,
      sql,
      answer: emptyResultAnswer(question),
      rowCount: result.rows.length,
      previewRows,
      columns,
      emptyResult: true,
    }
  }

  const deterministic = tryDeterministicAnswer(question, columns, previewRows)
  if (deterministic) {
    onStatus?.('Answered from query results')
    return {
      questionId,
      sql,
      answer: deterministic,
      rowCount: result.rows.length,
      previewRows,
      columns,
    }
  }

  onStatus?.('Model is summarizing query results…')
  const answerPrompt = buildAnswerPrompt(question, sql, columns, previewRows)
  const answer = await provider.complete(
    [
      { role: 'system', content: answerPrompt.system },
      { role: 'user', content: answerPrompt.user },
    ],
    {
      temperature: 0,
      onChunk: (t) => onStatus?.(`Writing answer… ${t.length} chars`),
    },
  )

  return {
    questionId,
    sql,
    answer: answer.trim(),
    rowCount: result.rows.length,
    previewRows,
    columns,
  }
}
