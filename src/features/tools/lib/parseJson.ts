export interface JsonParseError {
  message: string
  line?: number
  column?: number
  hint?: string
  /** 0-based index into the input where the problem likely starts */
  index?: number
}

export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: JsonParseError }

const COMMON_TYPOS: { pattern: RegExp; hint: string }[] = [
  { pattern: /\bfale\b/i, hint: 'Did you mean `false`? (JSON uses lowercase true/false)' },
  { pattern: /\bflase\b/i, hint: 'Did you mean `false`?' },
  { pattern: /\btru\b(?!e)/i, hint: 'Did you mean `true`?' },
  { pattern: /\bTrue\b|\bFalse\b|\bNone\b|\bNull\b/, hint: 'JSON requires lowercase true / false / null' },
  { pattern: /,\s*[}\]]/, hint: 'Trailing commas are not allowed in JSON' },
  { pattern: /'[^']*'/, hint: 'JSON strings must use double quotes (")' },
]

function indexToLineCol(text: string, index: number): { line: number; column: number } {
  let line = 1
  let column = 1
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column }
}

function extractPosition(message: string, input: string): number | undefined {
  // V8: "... at position 42"
  const posMatch = message.match(/position\s+(\d+)/i)
  if (posMatch) return Number(posMatch[1])

  // Chromium often embeds a snippet: ..."dent": fale, "skil"...
  const snippetMatch = message.match(/\.\.\."([^"]{0,40})"/)
  if (snippetMatch) {
    const needle = snippetMatch[1]
    const idx = input.indexOf(needle)
    if (idx >= 0) return idx
  }

  // Try to find unquoted literal near known bad tokens
  for (const { pattern } of COMMON_TYPOS) {
    const m = input.match(pattern)
    if (m?.index != null) return m.index
  }

  return undefined
}

function findHint(input: string, message: string): string | undefined {
  for (const { pattern, hint } of COMMON_TYPOS) {
    if (pattern.test(input) || pattern.test(message)) return hint
  }
  if (/Unexpected token/.test(message)) {
    return 'Check for typos, missing quotes, or unquoted values (e.g. false not fale).'
  }
  return undefined
}

export function parseJsonSafe(input: string): JsonParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: { message: 'Paste JSON to continue.' } }
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Invalid JSON'
    // Map offset back onto original input (account for trim)
    const trimStart = input.indexOf(trimmed)
    let index = extractPosition(raw, trimmed)
    if (index != null && trimStart >= 0) index += trimStart

    const loc = index != null ? indexToLineCol(input, index) : undefined
    const hint = findHint(input, raw)

    let message = raw.replace(/^JSON\.parse:\s*/i, '')
    if (loc) {
      message = `Line ${loc.line}, column ${loc.column}: ${message}`
    }

    return {
      ok: false,
      error: {
        message,
        line: loc?.line,
        column: loc?.column,
        index,
        hint,
      },
    }
  }
}

export function formatJsonParseError(prefix: string, error: JsonParseError): string {
  const parts = [`${prefix}${error.message}`]
  if (error.hint) parts.push(error.hint)
  return parts.join(' — ')
}
