import type { LlmProvider } from '../llm/types'
import type { AskQuestion } from '../llm/types'
import { buildGenerateQuestionsPrompt } from '../prompts/askPrompts'
import type { FileContextBlock } from './contextBuilder'
import { parseModelJson } from './sqlGuard'

const MAX_QUESTIONS = 5

function coerceQuestionList(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed

  if (parsed && typeof parsed === 'object') {
    const rec = parsed as Record<string, unknown>
    for (const key of ['questions', 'items', 'data', 'results', 'suggestions']) {
      const value = rec[key]
      if (Array.isArray(value)) return value
    }
    // Single question object
    if (typeof rec.question === 'string' && rec.question.trim()) {
      return [rec]
    }
  }

  return null
}

/** Recover questions when the model returns JSONL objects or `"question":"..."` fields. */
function extractQuestionsFromText(raw: string): AskQuestion[] {
  const questions: AskQuestion[] = []
  const seen = new Set<string>()

  const push = (id: string, question: string, rationale?: string) => {
    const q = question.trim()
    if (!q || seen.has(q.toLowerCase())) return
    seen.add(q.toLowerCase())
    const item: AskQuestion = { id, question: q }
    if (rationale) item.rationale = rationale
    questions.push(item)
  }

  // JSONL-style: one object per line
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/,$/, '')
    if (!trimmed.startsWith('{') || !trimmed.includes('"question"')) continue
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>
      const question = String(obj.question ?? '').trim()
      if (!question) continue
      push(String(obj.id ?? `q${questions.length + 1}`), question, obj.rationale != null ? String(obj.rationale) : undefined)
    } catch {
      /* ignore line */
    }
  }

  if (questions.length >= 1) return questions.slice(0, MAX_QUESTIONS)

  // Scattered "question":"..." fields in a broken blob
  const fieldRe = /"question"\s*:\s*"((?:\\.|[^"\\])*)"/g
  let match: RegExpExecArray | null
  let i = 0
  while ((match = fieldRe.exec(raw)) !== null) {
    i += 1
    try {
      push(`q${i}`, JSON.parse(`"${match[1]}"`) as string)
    } catch {
      push(`q${i}`, match[1].replace(/\\"/g, '"'))
    }
    if (questions.length >= MAX_QUESTIONS) break
  }

  if (questions.length >= 1) return questions.slice(0, MAX_QUESTIONS)

  // Numbered plain-text list: 1. ... / - ...
  const lineRe = /(?:^|\n)\s*(?:\d+[.)]\s+|[-*]\s+)(.+)/g
  let n = 0
  while ((match = lineRe.exec(raw)) !== null) {
    const text = match[1].replace(/^["']|["']$/g, '').trim()
    if (text.length < 8 || text.length > 240) continue
    if (/^[{[]/.test(text)) continue
    n += 1
    push(`q${n}`, text)
    if (questions.length >= MAX_QUESTIONS) break
  }

  return questions.slice(0, MAX_QUESTIONS)
}

function toAskQuestions(items: unknown[]): AskQuestion[] {
  const questions: AskQuestion[] = []
  for (const [index, item] of items.entries()) {
    if (typeof item === 'string') {
      const question = item.trim()
      if (!question) continue
      questions.push({ id: `q${index + 1}`, question })
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>
      const question = String(rec.question ?? rec.text ?? rec.q ?? '').trim()
      if (!question) continue
      const q: AskQuestion = {
        id: String(rec.id ?? `q${index + 1}`),
        question,
      }
      if (rec.rationale != null) q.rationale = String(rec.rationale)
      questions.push(q)
    }
    if (questions.length >= MAX_QUESTIONS) break
  }
  return questions
}

export async function generateQuestions(
  provider: LlmProvider,
  contexts: FileContextBlock[],
  onChunk?: (text: string) => void,
): Promise<AskQuestion[]> {
  const { system, user } = buildGenerateQuestionsPrompt(contexts)
  const raw = await provider.complete(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.3, onChunk },
  )

  let questions: AskQuestion[] = []

  try {
    const parsed = parseModelJson(raw, 'array')
    const list = coerceQuestionList(parsed)
    if (list) questions = toAskQuestions(list)
  } catch {
    /* fall through to text recovery */
  }

  if (questions.length === 0) {
    questions = extractQuestionsFromText(raw)
  }

  if (questions.length === 0) {
    throw new Error(
      'Could not read questions from the model reply. Try Suggest again, or ask your own question.',
    )
  }

  return questions.slice(0, MAX_QUESTIONS)
}
