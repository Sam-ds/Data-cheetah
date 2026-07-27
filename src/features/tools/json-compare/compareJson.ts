import { diffLines, type DiffLine } from '../lib/lineDiff'
import { parseJsonSafe, formatJsonParseError } from '../lib/parseJson'

export type { DiffLine }

export interface JsonCompareFailure {
  ok: false
  error: string
  /** Which pane failed validation */
  side: 'left' | 'right' | 'both'
  leftError?: string
  rightError?: string
}

/** Sort object keys recursively so JSON diffs ignore key order. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys)
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key])
    }
    return sorted
  }
  return value
}

export function normalizeJson(
  input: string,
):
  | { ok: true; text: string }
  | { ok: false; error: string; parseError: ReturnType<typeof parseJsonSafe> & { ok: false } } {
  const parsed = parseJsonSafe(input)
  if (!parsed.ok) {
    return {
      ok: false,
      error: formatJsonParseError('', parsed.error),
      parseError: parsed,
    }
  }
  return { ok: true, text: JSON.stringify(sortKeys(parsed.value), null, 2) }
}

export function compareJson(
  left: string,
  right: string,
):
  | {
      ok: true
      lines: DiffLine[]
      leftNormalized: string
      rightNormalized: string
    }
  | JsonCompareFailure {
  const a = normalizeJson(left)
  const b = normalizeJson(right)

  if (!a.ok && !b.ok) {
    return {
      ok: false,
      side: 'both',
      error: `Both sides have invalid JSON.\nLeft: ${a.error}\nRight: ${b.error}`,
      leftError: a.error,
      rightError: b.error,
    }
  }
  if (!a.ok) {
    return {
      ok: false,
      side: 'left',
      error: `Left JSON: ${a.error}`,
      leftError: a.error,
    }
  }
  if (!b.ok) {
    return {
      ok: false,
      side: 'right',
      error: `Right JSON: ${b.error}`,
      rightError: b.error,
    }
  }

  return {
    ok: true,
    lines: diffLines(a.text, b.text),
    leftNormalized: a.text,
    rightNormalized: b.text,
  }
}
