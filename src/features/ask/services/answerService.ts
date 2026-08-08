import { duckdbClient } from '@/services/duckdbClient'
import type { QueryResult } from '@/types/query'
import type { AskAnswer, AskQueryStep, LlmProvider } from '../llm/types'
import {
  buildAnswerPrompt,
  buildMultiStepAnswerPrompt,
  buildSqlForQuestionPrompt,
  buildSqlPlanPrompt,
} from '../prompts/askPrompts'
import type { FileContextBlock } from './contextBuilder'
import { findSharedJoinColumns, formatColumnInventory } from './contextBuilder'
import {
  applyCatalogDidYouMean,
  applyDateBinderRepair,
  collectDateColumnNames,
  collectSqlIdentifiers,
  collectTableNames,
  extractPlanStepsFromModelRaw,
  extractSqlFromModel,
  repairDateIntegerComparisons,
  repairDuckdbStringQuotes,
  repairCaseInsensitiveTextFilters,
  repairMysqlBackticks,
  repairUnknownTableNames,
  repairUnquotedIdentifiers,
  scrubSqlExtractionJunk,
  splitSelectStatements,
} from './sqlGuard'

const RESULT_CAP = 20
const ASK_ROW_LIMIT_FLOOR = 500
const MAX_PLAN_STEPS = 3

type PlannedStep = { goal: string; sql: string }

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

function isAggregateColumnName(col: string): boolean {
  const c = col.trim()
  return (
    /^(count|sum|avg|mean|min|max|total|cnt)(_|\(|$)/i.test(c) ||
    /count_star|count\(\*\)|count\s*\(/i.test(c) ||
    /^agg[_]/i.test(c)
  )
}

function isCountQuestion(question: string): boolean {
  return /\b(how many|how much|count(?:\s+of)?|number of|total number of|what(?:'s| is) the (?:total )?count)\b/i.test(
    question,
  )
}

/** Pull a readable subject from “how many X …” style questions. */
function extractCountSubject(question: string): string | null {
  const cleaned = question.replace(/[?!.]+$/g, '').trim()
  const patterns = [
    /\bhow many\s+(.+?)(?:\s+are\s+there|\s+is\s+there|\s+do\s+we|\s+does\s+|\s+in\b|\s+on\b|\s+from\b|\s+with\b|\?|$)/i,
    /\bnumber of\s+(.+?)(?:\s+are\s+there|\s+in\b|\s+on\b|\s+from\b|\?|$)/i,
    /\bcount(?:\s+of)?\s+(.+?)(?:\s+in\b|\s+on\b|\s+from\b|\?|$)/i,
  ]
  for (const re of patterns) {
    const m = cleaned.match(re)
    const subject = m?.[1]?.trim().replace(/\s+/g, ' ')
    if (subject && subject.length >= 2 && subject.length <= 80) return subject
  }
  return null
}

function naturalCountSentence(question: string, value: string): string {
  const subject = extractCountSubject(question)
  const n = Number(value)
  const isOne = Number.isFinite(n) && n === 1
  if (subject) {
    // Keep the user's wording (e.g. "airports") — only flip verb agreement.
    if (isOne) return `There is ${value} ${subject}.`
    return `There are ${value} ${subject}.`
  }
  if (isOne) return `There is ${value}.`
  return `There are ${value}.`
}

function naturalSingleValueAnswer(question: string, col: string, value: string): string {
  if (isCountQuestion(question) || isAggregateColumnName(col)) {
    return naturalCountSentence(question, value)
  }
  // Avoid dumping raw aggregate aliases for non-count questions too
  if (isAggregateColumnName(col)) {
    return `The result is ${value}.`
  }
  return `The ${col} is ${value}.`
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
    return `${winner} has the ${ascending ? 'lower' : 'higher'} value (${formatCell(best[metricCol])}) compared with ${others[0]}.`
  }
  if (others.length > 1) {
    return `${winner} leads with ${formatCell(best[metricCol])} (ahead of ${others.join(', ')}).`
  }
  return `${winner} has ${formatCell(best[metricCol])}.`
}

/**
 * Prefer a natural one-liner for tiny result sets so the model cannot invent figures.
 * Falls back to null → caller may use the LLM for richer multi-row summaries.
 */
export function tryDeterministicAnswer(
  question: string,
  columns: string[],
  rows: Record<string, unknown>[],
): string | null {
  if (isUnusableResult(rows)) return emptyResultAnswer(question)

  if (rows.length === 1 && columns.length === 1) {
    const col = columns[0]!
    return naturalSingleValueAnswer(question, col, formatCell(rows[0]![col]))
  }

  if (rows.length === 1 && columns.length <= 4) {
    const row = rows[0]!
    // Single numeric aggregate among columns → treat as a count/total answer when question fits
    const numericCols = columns.filter((c) => asFiniteNumber(row[c]) != null)
    if (
      numericCols.length === 1 &&
      (isCountQuestion(question) || isAggregateColumnName(numericCols[0]!))
    ) {
      return naturalCountSentence(question, formatCell(row[numericCols[0]!]))
    }
    const parts = columns.map((c) => {
      const label = isAggregateColumnName(c) ? 'value' : c
      return `${label} ${formatCell(row[c])}`
    })
    return parts.length === 1
      ? `The ${parts[0]}.`
      : `Here is what the data shows: ${parts.join('; ')}.`
  }

  const comparison = tryComparisonAnswer(question, columns, rows)
  if (comparison) return comparison

  if (rows.length <= 8 && columns.length <= 4) {
    const lines = rows.map((row, i) => {
      const parts = columns.map((c) => {
        const label = isAggregateColumnName(c) ? 'value' : c
        return `${label} ${formatCell(row[c])}`
      })
      return `${i + 1}. ${parts.join(', ')}`
    })
    return `Here are the ${rows.length} matching rows:\n${lines.join('\n')}`
  }

  return null
}

function prepareSql(
  sql: string,
  knownIds: string[],
  tableNames: string[],
  dateColumns: string[],
): string {
  const noBackticks = repairMysqlBackticks(sql)
  const withTables = repairUnknownTableNames(noBackticks, tableNames)
  const withSpacedIds = repairUnquotedIdentifiers(withTables, [
    ...knownIds,
    ...tableNames,
    ...dateColumns,
  ])
  const withDates = repairDateIntegerComparisons(withSpacedIds, dateColumns)
  const quoted = repairDuckdbStringQuotes(withDates, [...knownIds, ...tableNames, ...dateColumns])
  return scrubSqlExtractionJunk(repairCaseInsensitiveTextFilters(quoted))
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

async function runSqlWithRepairs(
  provider: LlmProvider,
  contexts: FileContextBlock[],
  question: string,
  initialSql: string,
  effectiveLimit: number,
  knownIds: string[],
  tableNames: string[],
  dateColumns: string[],
  onStatus?: (text: string) => void,
): Promise<{ sql: string; result: QueryResult | null; error: string | null }> {
  let sql = prepareSql(initialSql, knownIds, tableNames, dateColumns)
  let result: QueryResult | null = null
  let lastError: string | null = null

  try {
    const ran = await runSql(sql, effectiveLimit, knownIds, tableNames, dateColumns)
    sql = ran.sql
    result = ran.result
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
  }

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

  return { sql, result, error: result ? null : lastError }
}

function extractPlanSteps(raw: string): PlannedStep[] {
  return extractPlanStepsFromModelRaw(raw, MAX_PLAN_STEPS)
}

/** Expand a single planned step into multiple when the model packed several SELECTs together. */
function expandPlannedSteps(planned: PlannedStep[]): PlannedStep[] {
  const out: PlannedStep[] = []
  for (const step of planned) {
    const pieces = splitSelectStatements(step.sql)
    if (pieces.length <= 1) {
      out.push(step)
      continue
    }
    for (const [i, sql] of pieces.entries()) {
      out.push({
        goal: pieces.length > 1 ? `${step.goal} (${i + 1}/${pieces.length})` : step.goal,
        sql,
      })
      if (out.length >= MAX_PLAN_STEPS) return out
    }
  }
  return out.slice(0, MAX_PLAN_STEPS)
}

function combineStepSql(steps: AskQueryStep[]): string {
  return steps
    .map((s, i) => `-- Step ${i + 1}: ${s.goal}\n${s.sql}${s.sql.trim().endsWith(';') ? '' : ';'}`)
    .join('\n\n')
}

/** Prefer a multi-row sample for the results grid; else first successful step. */
function pickDisplayStep(steps: AskQueryStep[]): AskQueryStep | null {
  const ok = steps.filter((s) => !s.error && s.rowCount > 0)
  if (ok.length === 0) return steps.find((s) => !s.error) ?? steps[0] ?? null
  return ok.find((s) => s.rowCount > 1) ?? ok[ok.length - 1]!
}

function looksMultiPartQuestion(question: string): boolean {
  const q = question.trim()
  if (/\bhow many\b/i.test(q) && /\b(name|list|show|give|examples?)\b/i.test(q)) return true
  if (/\b(and|also|;)\b/i.test(q) && /\b(name|list|show|give|count|how many)\b/i.test(q)) return true
  const sentences = q.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
  return sentences.length >= 2
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

  onStatus?.('Planning SQL steps…')
  const planPrompt = buildSqlPlanPrompt(contexts, question)
  let planned: PlannedStep[] = []
  try {
    const planRaw = await provider.complete(
      [
        { role: 'system', content: planPrompt.system },
        { role: 'user', content: planPrompt.user },
      ],
      {
        temperature: 0.1,
        onChunk: (t) => onStatus?.(`Planning… ${t.length} chars`),
      },
    )
    planned = expandPlannedSteps(extractPlanSteps(planRaw))
  } catch {
    planned = []
  }

  // Multi-part question but only one step planned → ask again for 2+ steps
  if (planned.length === 1 && looksMultiPartQuestion(question)) {
    onStatus?.('Question has multiple parts — planning extra SQL steps…')
    try {
      const retryRaw = await provider.complete(
        [
          {
            role: 'system',
            content: `${planPrompt.system}

IMPORTANT: The user question has MULTIPLE parts. You MUST return 2 or 3 steps in {"steps":[...]}.
Do not combine everything into one SELECT. Example: count in step 1, list/examples in step 2.`,
          },
          {
            role: 'user',
            content: `${planPrompt.user}

Previous plan had only 1 step — rewrite with 2–3 separate steps.`,
          },
        ],
        {
          temperature: 0.15,
          onChunk: (t) => onStatus?.(`Re-planning… ${t.length} chars`),
        },
      )
      const retried = expandPlannedSteps(extractPlanSteps(retryRaw))
      if (retried.length > planned.length) planned = retried
    } catch {
      /* keep original single step */
    }
  }

  // Fallback to single-SQL prompt if planning failed
  if (planned.length === 0) {
    onStatus?.('Writing SQL…')
    const sqlPrompt = buildSqlForQuestionPrompt(contexts, question)
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
    planned = expandPlannedSteps([
      { goal: 'Answer question', sql: extractSqlFromModel(sqlRaw) },
    ])
  }

  const executed: AskQueryStep[] = []
  for (const [index, step] of planned.entries()) {
    onStatus?.(`Running step ${index + 1} of ${planned.length}: ${step.goal}`)
    const ran = await runSqlWithRepairs(
      provider,
      contexts,
      `${question} (${step.goal})`,
      step.sql,
      effectiveLimit,
      knownIds,
      tableNames,
      dateColumns,
      onStatus,
    )

    if (ran.result && isUnusableResult(ran.result.rows) && planned.length === 1) {
      onStatus?.('No usable rows — asking model for a simpler query…')
      const allowedTables = contexts.map((c) => `"${c.tableName}"`).join(', ')
      try {
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
                .join('\n')}\n\nQuestion: ${question}\n\nPrevious SQL (empty/null):\n${ran.sql}`,
            },
          ],
          {
            temperature: 0.1,
            onChunk: (t) => onStatus?.(`Retrying SQL… ${t.length} chars`),
          },
        )
        const retry = await runSqlWithRepairs(
          provider,
          contexts,
          question,
          extractSqlFromModel(retryRaw),
          effectiveLimit,
          knownIds,
          tableNames,
          dateColumns,
          onStatus,
        )
        if (retry.result && !isUnusableResult(retry.result.rows)) {
          const columns = normalizeResultColumns(retry.result.columns, retry.result.rows)
          executed.push({
            goal: step.goal,
            sql: retry.sql,
            columns,
            previewRows: retry.result.rows.slice(0, RESULT_CAP),
            rowCount: retry.result.rows.length,
          })
          continue
        }
      } catch {
        /* keep original */
      }
    }

    if (!ran.result) {
      executed.push({
        goal: step.goal,
        sql: ran.sql,
        columns: [],
        previewRows: [],
        rowCount: 0,
        error: ran.error ?? 'Query failed',
      })
      continue
    }

    const columns = normalizeResultColumns(ran.result.columns, ran.result.rows)
    executed.push({
      goal: step.goal,
      sql: ran.sql,
      columns,
      previewRows: ran.result.rows.slice(0, RESULT_CAP),
      rowCount: ran.result.rows.length,
      error: isUnusableResult(ran.result.rows) ? 'No usable rows' : undefined,
    })
  }

  const combinedSql = combineStepSql(executed)
  const display = pickDisplayStep(executed)
  const anyOk = executed.some((s) => !s.error && s.rowCount > 0)

  if (!anyOk) {
    return {
      questionId,
      sql: combinedSql,
      answer: '',
      rowCount: 0,
      previewRows: [],
      columns: [],
      steps: executed,
      error:
        executed.find((s) => s.error)?.error ??
        'DuckDB could not run the generated SQL. Try another question or inspect the SQL.',
    }
  }

  // Multi-step (or compound) → always synthesize with LLM from all evidence
  if (executed.length > 1) {
    onStatus?.('Writing final answer from all steps…')
    const prompt = buildMultiStepAnswerPrompt(
      question,
      executed.map((s) => ({
        goal: s.goal,
        sql: s.sql,
        columns: s.columns,
        rows: s.previewRows,
        rowCount: s.rowCount,
        error: s.error,
      })),
    )
    const answer = await provider.complete(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      {
        temperature: 0.1,
        onChunk: (t) => onStatus?.(`Writing answer… ${t.length} chars`),
      },
    )
    return {
      questionId,
      sql: combinedSql,
      answer: answer.trim(),
      rowCount: display?.rowCount ?? 0,
      previewRows: display?.previewRows ?? [],
      columns: display?.columns ?? [],
      steps: executed,
    }
  }

  // Single step → for multi-part questions still synthesize with LLM
  const only = executed[0]!
  if (looksMultiPartQuestion(question)) {
    onStatus?.('Writing final answer…')
    const prompt = buildMultiStepAnswerPrompt(question, [
      {
        goal: only.goal,
        sql: only.sql,
        columns: only.columns,
        rows: only.previewRows,
        rowCount: only.rowCount,
        error: only.error,
      },
    ])
    const answer = await provider.complete(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      {
        temperature: 0.1,
        onChunk: (t) => onStatus?.(`Writing answer… ${t.length} chars`),
      },
    )
    return {
      questionId,
      sql: combinedSql,
      answer: answer.trim(),
      rowCount: only.rowCount,
      previewRows: only.previewRows,
      columns: only.columns,
      steps: executed,
    }
  }

  return finishAnswer(
    provider,
    questionId,
    question,
    only.sql,
    { columns: only.columns, rows: only.previewRows },
    onStatus,
    executed,
  )
}

async function finishAnswer(
  provider: LlmProvider,
  questionId: string,
  question: string,
  sql: string,
  result: { columns: string[]; rows: Record<string, unknown>[] },
  onStatus?: (text: string) => void,
  steps?: AskQueryStep[],
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
      steps,
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
      steps,
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
    steps,
  }
}

// Keep rewriteSqlAfterError below — remove old answerQuestion/runSql duplicates by deleting the old block.
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
  const inventory = formatColumnInventory(contexts)
  const shared = findSharedJoinColumns(contexts)
  const joinHint =
    shared.length > 0
      ? `Shared join columns only: ${shared.join(', ')}`
      : 'No shared columns — remove JOINs; query one table or UNION ALL aggregates. Never invent id keys.'

  const raw = await provider.complete(
    [
      {
        role: 'system',
        content: `Fix the DuckDB SQL. Return ONLY JSON: {"sql":"SELECT ..."}.
Rules:
- Use ONLY these exact table names: ${allowedTables}
- Use ONLY columns from COLUMN INVENTORY — never invent columns (especially not id unless listed)
- ${joinHint}
- If the error is a missing column on a JOIN, drop the JOIN or switch to a column that exists on both tables
- String literals use single quotes: "Country" = 'US' (never "US")
- Identifiers use double quotes for table/column names that need them (spaces / mixed case) — never MySQL/BigQuery backticks
- Columns with spaces must be quoted: "First Name", "Subscription Date"
- One read-only SELECT or WITH ... SELECT
- Never compare DATE/TIMESTAMP to an integer year — use DATE '1984-01-01' or EXTRACT(year FROM col) = 1984
- Prefer simple filters: lat = 1.2 AND lon = 3.4 (not row IN tuples)`,
      },
      {
        role: 'user',
        content: `ALLOWED TABLES: ${allowedTables}

COLUMN INVENTORY:
${inventory}

Tables:
${tables}

Question: ${question}

Broken SQL:
${badSql}

DuckDB error:
${errorMessage}

Return corrected {"sql":"..."}. Fix missing/invented columns. Do not invent join keys.`,
      },
    ],
    {
      temperature: 0,
      onChunk: (t) => onStatus?.(`Fixing SQL… ${t.length} chars`),
    },
  )
  return extractSqlFromModel(raw)
}
