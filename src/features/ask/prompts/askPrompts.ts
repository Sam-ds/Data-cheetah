import type { FileContextBlock } from '../services/contextBuilder'
import {
  findSharedJoinColumns,
  formatColumnInventory,
  formatTableContextForPrompt,
} from '../services/contextBuilder'
import type { InsightFinding } from '../llm/types'

export function buildGenerateInsightsPrompt(contexts: FileContextBlock[]): {
  system: string
  user: string
} {
  const tables = contexts.map(formatTableContextForPrompt).join('\n\n')
  const shared = findSharedJoinColumns(contexts)
  const joinHint =
    contexts.length < 2
      ? 'Only one table is loaded — do not propose cross-table joins.'
      : shared.length > 0
        ? `Cross-table probes may JOIN only on these shared columns: ${shared.map((c) => `"${c}"`).join(', ')}.`
        : 'Tables have NO shared column names — do NOT propose JOIN probes. Compare tables with separate aggregates or UNION ALL of summaries instead.'

  return {
    system: `You are a senior data analyst. Given DuckDB table schemas, optional human descriptions, and sample rows, propose useful analytical probes that will surface real insights (not trivia).
When table/column descriptions are present, respect grain, units, relationships, and notes.
${joinHint}
Never invent columns like id/user_id unless they appear in the schema.
Output rules (strict):
- Reply with ONLY a JSON array. No markdown fences. No prose before or after.
- Exactly 5 objects.
- Shape: [{"id":"i1","question":"...","rationale":"..."}, ...]
- "question" is a clear analytical probe the SQL engine can answer (counts, mixes, trends, outliers, comparisons).
- Prefer high-value business/data insights over obvious schema restatements.
- Do NOT wrap in {"questions":[...]}. The top-level value must be an array.
Probes must be answerable with SELECT queries on the given tables.`,
    user: `Tables:\n\n${tables}\n\nReturn ONLY this JSON array (exactly 5 items), nothing else:
[{"id":"i1","question":"...","rationale":"..."},{"id":"i2","question":"...","rationale":"..."},{"id":"i3","question":"...","rationale":"..."},{"id":"i4","question":"...","rationale":"..."},{"id":"i5","question":"...","rationale":"..."}]`,
  }
}

/** @deprecated Use buildGenerateInsightsPrompt */
export function buildGenerateQuestionsPrompt(contexts: FileContextBlock[]) {
  return buildGenerateInsightsPrompt(contexts)
}

export function buildSqlForQuestionPrompt(
  contexts: FileContextBlock[],
  question: string,
): { system: string; user: string } {
  const allowedTables = contexts.map((c) => `"${c.tableName}"`).join(', ')
  const tables = contexts.map(formatTableContextForPrompt).join('\n\n')
  const inventory = formatColumnInventory(contexts)
  const shared = findSharedJoinColumns(contexts)
  const joinRule =
    shared.length > 0
      ? `JOIN only on columns that exist on BOTH sides. Shared column names available: ${shared
          .map((c) => (/\s|[^A-Za-z0-9_]/.test(c) ? `"${c}"` : c))
          .join(', ')}. Prefer ON T1."Col" = T2."Col" using those names.`
      : `Do NOT JOIN tables — there are no shared column names. Answer with a query on one table, or compare via UNION ALL of aggregates. Never invent keys like id, user_id, or customer_id.`

  return {
    system: `You write DuckDB SQL. Given schemas, optional descriptions, sample rows, and an analytical probe, return ONLY valid JSON (no markdown):
{"sql":"SELECT ..."}
Rules:
- One read-only SELECT or WITH ... SELECT
- Use ONLY the exact table names listed under ALLOWED TABLES — copy them character-for-character (if the table is "boooks", never write books)
- Use ONLY columns listed under COLUMN INVENTORY for each table — never invent columns (especially not id / *_id unless listed)
- ${joinRule}
- Prefer joins and filters described in Relationships / Notes when present AND columns exist
- Table/column identifiers: double quotes when needed (FROM "boooks") — never MySQL/BigQuery backticks
- Column names with spaces or mixed case MUST be double-quoted exactly as listed: "First Name", "Country"
- String and date literals: ALWAYS single quotes — "Country" = 'US' NOT "Country" = "US"
- Double quotes around a value like "US" make DuckDB look for a column named US and fail
- Compare points with AND: lat = 33.64 AND lon = -84.42 — do NOT use (lat, lon) IN (x, y)
- Match sample value casing for filters
- Prefer aggregates (COUNT, GROUP BY) over overly selective WHERE clauses
- For “which / who has more|most|least …” questions, return the winning row only (ORDER BY metric DESC/ASC LIMIT 1), not the full breakdown
- Prefer LIMIT 100 unless an aggregate returns few rows
- Dates: never compare a DATE/TIMESTAMP column to a bare integer. Use DATE '1984-01-01' or EXTRACT(year FROM order_date) = 1984 — not order_date >= 1984
- No INSERT/UPDATE/DELETE/DROP/ATTACH/COPY/CREATE`,
    user: `ALLOWED TABLES (exact names only): ${allowedTables}

COLUMN INVENTORY (use only these columns; quote names with spaces/case as shown):
${inventory}

Schemas and samples:

${tables}

Analytical probe: ${question}

Return ONLY {"sql":"..."} JSON. Use exact ALLOWED TABLES names and COLUMN INVENTORY only. Never invent join keys. Quote mixed-case / spaced columns. Strings use single quotes ('US'). Dates use DATE 'YYYY-MM-DD' or EXTRACT(year FROM col). For comparison probes, LIMIT 1 to the winner.`,
  }
}

/**
 * Plan 1–3 DuckDB steps for compound questions like
 * "how many airports are there? name some".
 */
export function buildSqlPlanPrompt(
  contexts: FileContextBlock[],
  question: string,
): { system: string; user: string } {
  const allowedTables = contexts.map((c) => `"${c.tableName}"`).join(', ')
  const tables = contexts.map(formatTableContextForPrompt).join('\n\n')
  const inventory = formatColumnInventory(contexts)
  const shared = findSharedJoinColumns(contexts)
  const joinRule =
    shared.length > 0
      ? `JOIN only on shared columns: ${shared.map((c) => `"${c}"`).join(', ')}.`
      : `Do NOT invent join keys. Prefer single-table queries or UNION ALL of aggregates.`

  return {
    system: `You are a DuckDB analyst. Break the user's question into 1–3 read-only SQL steps, then we will run each and summarize.
Return ONLY JSON (no markdown):
{"steps":[{"goal":"short purpose","sql":"SELECT ..."}, ...]}

Rules:
- Use 2–3 steps when the question has multiple asks (count + list examples, compare + explain, total + sample rows, etc.)
- Use 1 step only for a single simple ask
- Each step is one SELECT or WITH ... SELECT — never put two SELECTs in one step
- Put each SELECT in its own steps[i].sql string (JSON-escaped). Do not omit later steps.
- Use ONLY ALLOWED TABLES and COLUMN INVENTORY — never invent columns like id
- ${joinRule}
- Quote mixed-case / spaced columns exactly as listed — use double quotes, never MySQL/BigQuery backticks
- String literals: single quotes ('US')
- For "name some / list some / give examples", use a separate step with LIMIT 5–10 of useful label columns
- For "how many / count", use COUNT(*) (or COUNT(DISTINCT …) if clearly needed)
- Prefer LIMIT 100 on list steps
- No INSERT/UPDATE/DELETE/DROP/ATTACH/COPY/CREATE`,
    user: `ALLOWED TABLES: ${allowedTables}

COLUMN INVENTORY:
${inventory}

Schemas and samples:

${tables}

User question: ${question}

Return ONLY {"steps":[...]} JSON (1–3 steps).`,
  }
}

export function buildAnswerPrompt(
  question: string,
  sql: string,
  columns: string[],
  rows: Record<string, unknown>[],
): { system: string; user: string } {
  const preview = JSON.stringify({ columns, rowCount: rows.length, rows: rows.slice(0, 20) }, null, 2)
  return {
    system: `You turn DuckDB query results into a short natural-language answer. You are not allowed to invent data.
Rules (strict):
- Use ONLY numbers and labels that appear in the Result preview JSON.
- Do not use outside knowledge, estimates, or sample rows from earlier context.
- If a value is null, say it is null — do not replace it with a guess.
- Write plain prose a person would say (e.g. "There are 30 airports in the table."), not "Result for …: 30 (count_star())".
- Never mention SQL aggregate aliases like count_star(), COUNT(*), or column names unless they are real business labels from the data.
- Be concise (1–3 sentences). Plain text only — no JSON, no markdown fences.
- Lead with the insight (what matters), not a restatement of the SQL or the question.
- If the probe asks which/who has more, most, least, etc., state the winning label clearly first.`,
    user: `Question: ${question}\n\nSQL used:\n${sql}\n\nResult preview (ONLY source of truth):\n${preview}\n\nAnswer in natural language using only these results.`,
  }
}

export function buildMultiStepAnswerPrompt(
  question: string,
  steps: {
    goal: string
    sql: string
    columns: string[]
    rows: Record<string, unknown>[]
    rowCount: number
    error?: string
  }[],
): { system: string; user: string } {
  const evidence = steps
    .map((s, i) => {
      const preview = JSON.stringify(
        {
          goal: s.goal,
          columns: s.columns,
          rowCount: s.rowCount,
          rows: s.rows.slice(0, 12),
          error: s.error ?? null,
        },
        null,
        2,
      )
      return `### Step ${i + 1}: ${s.goal}
SQL:
${s.sql || '(none)'}
Result:
${preview}`
    })
    .join('\n\n')

  return {
    system: `You answer the user's question using evidence from one or more DuckDB query steps.
Rules (strict):
- Use ONLY values that appear in the step results. Never invent names, counts, or facts.
- Write natural prose a person would say. Example: "There are 30 airports in the table. Some names are Heathrow, Gatwick, and Stansted."
- Cover every part of a multi-part question (count + examples, compare + list, etc.)
- Do not mention SQL, count_star(), step numbers, or JSON field names unless needed for clarity.
- Skip failed steps briefly if others already answer the question.
- Be concise (2–5 sentences). Plain text only — no markdown fences.`,
    user: `User question: ${question}

Evidence from DuckDB steps:
${evidence}

Write the final natural-language answer now.`,
  }
}

export function buildFinalInsightsSummaryPrompt(findings: InsightFinding[]): {
  system: string
  user: string
} {
  const evidence = findings
    .map((f, i) => {
      const preview = JSON.stringify(
        {
          columns: f.columns,
          rowCount: f.rowCount,
          rows: f.previewRows.slice(0, 8),
          empty: Boolean(f.emptyResult) || f.rowCount === 0,
          error: f.error ?? null,
        },
        null,
        2,
      )
      return `### Finding ${i + 1}: ${f.title}
Per-query note: ${f.answer || '(none)'}
SQL: ${f.sql || '(none)'}
Result preview:
${preview}`
    })
    .join('\n\n')

  return {
    system: `You write a final insights briefing for a data workspace user.
Rules (strict):
- Synthesize ONLY from the findings and result previews provided.
- Do not invent numbers, labels, or trends that are not supported by the evidence.
- Skip or clearly mark findings that errored or returned empty results.
- Output plain text (no markdown fences). Use short paragraphs and optional bullet lines starting with "- ".
- Structure:
  1) 2–4 sentence executive summary of the most useful takeaways
  2) 3–6 concrete insight bullets grounded in the query results
  3) One short closing note on data caveats if relevant (empty queries, sparse samples)
- Prefer actionable, useful insights over restating schemas.`,
    user: `Evidence from DuckDB queries:\n\n${evidence}\n\nWrite the final insights briefing now.`,
  }
}
