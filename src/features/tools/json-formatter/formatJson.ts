import { parseJsonSafe, formatJsonParseError } from '../lib/parseJson'

export function formatJson(
  input: string,
): { ok: true; output: string } | { ok: false; error: string } {
  const parsed = parseJsonSafe(input)
  if (!parsed.ok) {
    return { ok: false, error: formatJsonParseError('', parsed.error) }
  }
  return { ok: true, output: JSON.stringify(parsed.value, null, 2) }
}
