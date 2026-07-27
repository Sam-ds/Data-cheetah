import type { FileContextBlock } from '../services/contextBuilder'
import { formatTableContextForPrompt } from '../services/contextBuilder'

export function buildGenerateQuestionsPrompt(contexts: FileContextBlock[]): {
  system: string
  user: string
} {
  const tables = contexts.map(formatTableContextForPrompt).join('\n\n')

  return {
    system: `You are a data analyst helper. Given DuckDB table schemas, optional human descriptions, and sample rows, propose useful analytical questions a user could answer with SQL.
When table/column descriptions are present, prefer questions that respect grain, units, relationships, and notes.
Output rules (strict):
- Reply with ONLY a JSON array. No markdown fences. No prose before or after.
- Exactly 5 objects.
- Shape: [{"id":"q1","question":"...","rationale":"..."}, ...]
- Do NOT wrap in {"questions":[...]}. The top-level value must be an array.
Prefer counts, breakdowns, trends, outliers, and joins across tables when multiple tables exist.
Questions must be answerable with SELECT queries on the given tables.`,
    user: `Tables:\n\n${tables}\n\nReturn ONLY this JSON array (exactly 5 items), nothing else:
[{"id":"q1","question":"...","rationale":"..."},{"id":"q2","question":"...","rationale":"..."},{"id":"q3","question":"...","rationale":"..."},{"id":"q4","question":"...","rationale":"..."},{"id":"q5","question":"...","rationale":"..."}]`,
  }
}

export function buildSqlForQuestionPrompt(
  contexts: FileContextBlock[],
  question: string,
): { system: string; user: string } {
  const allowedTables = contexts.map((c) => `"${c.tableName}"`).join(', ')
  const tables = contexts.map(formatTableContextForPrompt).join('\n\n')

  return {
    system: `You write DuckDB SQL. Given schemas, optional descriptions, sample rows, and a question, return ONLY valid JSON (no markdown):
{"sql":"SELECT ..."}
Rules:
- One read-only SELECT or WITH ... SELECT
- Use ONLY the exact table names listed under ALLOWED TABLES — copy them character-for-character (if the table is "boooks", never write books)
- Prefer joins and filters described in Relationships / Notes when present
- Table/column identifiers: double quotes when needed (FROM "boooks")
- String and date literals: ALWAYS single quotes — country = 'US' NOT country = "US"
- Double quotes around a value like "US" make DuckDB look for a column named US and fail
- Compare points with AND: lat = 33.64 AND lon = -84.42 — do NOT use (lat, lon) IN (x, y)
- Use only listed tables/columns; match sample value casing for filters
- Prefer aggregates (COUNT, GROUP BY) over overly selective WHERE clauses
- For “which / who has more|most|least …” questions, return the winning row only (ORDER BY metric DESC/ASC LIMIT 1), not the full breakdown
- Prefer LIMIT 100 unless an aggregate returns few rows
- Dates: never compare a DATE/TIMESTAMP column to a bare integer. Use DATE '1984-01-01' or EXTRACT(year FROM order_date) = 1984 — not order_date >= 1984
- No INSERT/UPDATE/DELETE/DROP/ATTACH/COPY/CREATE`,
    user: `ALLOWED TABLES (exact names only): ${allowedTables}

Schemas and samples:

${tables}

Question: ${question}

Return ONLY {"sql":"..."} JSON. Use exact ALLOWED TABLES names. Strings use single quotes ('US'). Dates use DATE 'YYYY-MM-DD' or EXTRACT(year FROM col). For comparison questions, LIMIT 1 to the winner.`,
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
    system: `You summarize DuckDB query results. You are not allowed to invent data.
Rules (strict):
- Use ONLY numbers and labels that appear in the Result preview JSON.
- Do not use outside knowledge, estimates, or sample rows from earlier context.
- If a value is null, say it is null — do not replace it with a guess.
- Be concise (2–4 sentences). Plain text only — no JSON, no markdown fences.
- If the question asks which/who has more, most, least, etc., state the winning label clearly first (do not only list every row).`,
    user: `Question: ${question}\n\nSQL used:\n${sql}\n\nResult preview (ONLY source of truth):\n${preview}\n\nSummarize these results only. If this is a comparison question, name the winner.`,
  }
}
