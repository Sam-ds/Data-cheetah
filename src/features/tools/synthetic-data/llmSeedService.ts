import type { ChatMessage, LlmProvider } from '@/features/ask/llm/types'
import { FAKER_PATH_WHITELIST, normalizeFakerPath, type SchemaColumn, type SchemaPlan } from './schemaPlan'
import { inferPlanFromSample } from './inferFromSample'

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
      min?: number
      max?: number
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
        min: typeof c.min === 'number' ? c.min : undefined,
        max: typeof c.max === 'number' ? c.max : undefined,
      } satisfies SchemaColumn
    })

  if (columns.length === 0) {
    return inferPlanFromSample(fallbackSample, seedCount)
  }

  const rows = Array.isArray(obj.rows) ? obj.rows.slice(0, seedCount) : []
  if (rows.length === 0) {
    const inferred = inferPlanFromSample(fallbackSample, seedCount)
    return { columns, rows: inferred.rows, source: 'llm' }
  }

  return { columns, rows, source: 'llm' }
}

export async function seedPlanWithLlm(
  provider: LlmProvider,
  sample: string,
  context: string,
  seedCount: number,
): Promise<SchemaPlan> {
  if (!provider.isReady()) {
    throw new Error('LLM is not ready. Connect a model in Settings / Ask, or generate without LLM.')
  }

  const system = `You help create synthetic tabular data plans for a browser app.
Return ONLY valid JSON (no markdown) with this shape:
{"columns":[{"name":"col","type":"string|number|integer|boolean|date","fakerPath":"<path>","notes":"...","min":0,"max":100,"enumValues":["a"]}],"rows":[{...}]}
Rules:
- Infer columns from the sample; respect the user's context.
- fakerPath MUST be one of: ${FAKER_PATH_WHITELIST.join(', ')}
- Include exactly ${seedCount} realistic seed rows in "rows" matching the columns.
- Prefer realistic values consistent with the sample and context.
- Do not invent SQL. Do not wrap JSON in markdown.`

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Context:\n${context.trim() || '(none)'}\n\nSample data:\n${sample.trim().slice(0, 12_000)}\n\nReturn the JSON plan with ${seedCount} seed rows.`,
    },
  ]

  const reply = await provider.complete(messages, { temperature: 0.4 })
  const parsed = extractJsonObject(reply)
  return coercePlan(parsed, sample, seedCount)
}
