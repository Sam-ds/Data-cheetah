import type { ChatMessage, LlmProvider } from '@/features/ask/llm/types'
import { FAKER_PATH_WHITELIST, normalizeFakerPath, type SchemaColumn, type SchemaPlan } from './schemaPlan'
import { inferPlanFromSample } from './inferFromSample'
import { applyColumnRules, parseBound, type ColumnRule } from './columnRules'

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1]!.trim() : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Model did not return a JSON object')
  }
  return JSON.parse(body.slice(start, end + 1))
}

function coercePlan(raw: unknown, fallbackSample: string, seedCount: number): SchemaPlan {
  const obj = raw as {
    columns?: {
      name?: string
      type?: string
      fakerPath?: string
      notes?: string
      enumValues?: string[]
      min?: number | string
      max?: number | string
      notNull?: boolean
      not_null?: boolean
      unique?: boolean
    }[]
    rows?: Record<string, unknown>[]
  }

  if (!Array.isArray(obj.columns) || obj.columns.length === 0) {
    return inferPlanFromSample(fallbackSample, seedCount)
  }

  const columns: SchemaColumn[] = obj.columns
    .filter((c) => c?.name)
    .map((c) => {
      const typeRaw = (c.type || 'string').toLowerCase()
      const type =
        typeRaw === 'integer' || typeRaw === 'int'
          ? 'integer'
          : typeRaw === 'number' || typeRaw === 'float' || typeRaw === 'double'
            ? 'number'
            : typeRaw === 'boolean' || typeRaw === 'bool'
              ? 'boolean'
              : typeRaw === 'date' || typeRaw === 'datetime'
                ? 'date'
                : 'string'
      const fallbackPath =
        type === 'integer'
          ? 'number.int'
          : type === 'number'
            ? 'number.float'
            : type === 'boolean'
              ? 'datatype.boolean'
              : type === 'date'
                ? 'date.past'
                : 'lorem.word'
      return {
        name: String(c.name),
        type,
        fakerPath: normalizeFakerPath(c.fakerPath, fallbackPath as 'lorem.word'),
        notes: c.notes,
        enumValues: Array.isArray(c.enumValues) ? c.enumValues.map(String) : undefined,
        min: parseBound(c.min, type === 'date'),
        max: parseBound(c.max, type === 'date'),
        notNull:
          typeof c.notNull === 'boolean'
            ? c.notNull
            : typeof c.not_null === 'boolean'
              ? c.not_null
              : true,
        unique: typeof c.unique === 'boolean' ? c.unique : false,
      } satisfies SchemaColumn
    })

  if (columns.length === 0) {
    if (!fallbackSample.trim()) {
      throw new Error('Model did not return columns and no sample was provided')
    }
    return inferPlanFromSample(fallbackSample, seedCount)
  }

  const rows = Array.isArray(obj.rows) ? obj.rows.slice(0, seedCount) : []
  if (rows.length === 0 && fallbackSample.trim()) {
    try {
      const inferred = inferPlanFromSample(fallbackSample, seedCount)
      return { columns, rows: inferred.rows, source: 'llm' }
    } catch {
      return { columns, rows: [], source: 'llm' }
    }
  }

  return { columns, rows, source: 'llm' }
}

export async function seedPlanWithLlm(
  provider: LlmProvider,
  sample: string,
  context: string,
  seedCount: number,
  onProgress?: (text: string, progress: number) => void,
  columnRules: ColumnRule[] = [],
): Promise<SchemaPlan> {
  if (!provider.isReady()) {
    throw new Error('LLM is not ready. Connect a model in Settings / Ask, or generate without LLM.')
  }

  const rulesHint =
    columnRules.length > 0
      ? `\nColumn constraints to honor in seed rows:\n${columnRules
          .map((r) => {
            const bits = [
              r.type ? `type=${r.type}` : null,
              r.unique ? 'unique' : null,
              r.notNull === false ? 'nullable' : 'not null',
              r.min != null
                ? `min=${r.type === 'date' ? new Date(r.min).toISOString().slice(0, 10) : r.min}`
                : null,
              r.max != null
                ? `max=${r.type === 'date' ? new Date(r.max).toISOString().slice(0, 10) : r.max}`
                : null,
            ].filter(Boolean)
            return `- ${r.name}: ${bits.join(', ')}`
          })
          .join('\n')}`
      : ''

  const system = `You help create synthetic tabular data plans for a browser app.
Return ONLY valid JSON (no markdown) with this shape:
{"columns":[{"name":"col","type":"string|number|integer|boolean|date","fakerPath":"<path>","notes":"...","min":0,"max":100,"enumValues":["a"],"notNull":true,"unique":false}],"rows":[{...}]}
Rules:
- Infer columns from the sample; respect the user's context and any column constraints.
- fakerPath MUST be one of: ${FAKER_PATH_WHITELIST.join(', ')}
- Include exactly ${seedCount} realistic seed rows in "rows" matching the columns.
- For unique columns, seed rows must not repeat values.
- For notNull columns, never use null or empty strings.
- Honor type and min/max ranges when provided (for dates use YYYY-MM-DD strings in seed rows; set min/max as numeric year bounds or omit and keep values inside the stated range).
- Prefer realistic values consistent with the sample and context.
- Do not invent SQL. Do not wrap JSON in markdown.`

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Context:\n${context.trim() || '(none)'}${rulesHint}\n\nSample data:\n${sample.trim().slice(0, 12_000) || '(none — use column constraints)'}\n\nReturn the JSON plan with ${seedCount} seed rows.`,
    },
  ]

  onProgress?.('Asking model for seed rows…', 0.05)
  const reply = await provider.complete(messages, {
    temperature: 0.4,
    onChunk: (accumulated) => {
      const approx = Math.min(0.95, 0.05 + accumulated.length / 8000)
      onProgress?.(`Generating seed plan… ${Math.round(approx * 100)}%`, approx)
    },
  })
  onProgress?.('Parsing seed plan…', 0.97)
  const parsed = extractJsonObject(reply)
  const plan = applyColumnRules(coercePlan(parsed, sample, seedCount), columnRules)
  onProgress?.('LLM seed ready', 1)
  return plan
}
