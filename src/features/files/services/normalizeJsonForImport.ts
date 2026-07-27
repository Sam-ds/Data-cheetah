function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isObjectRecord(item))
  )
}

function parseJsonLines(text: string): Record<string, unknown>[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    throw new Error('JSON file is empty')
  }

  return lines.map((line, index) => {
    try {
      const row = JSON.parse(line)
      if (!isObjectRecord(row)) {
        throw new Error(`Line ${index + 1}: expected a JSON object`)
      }
      return row
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Invalid JSON'
      throw new Error(`Line ${index + 1}: ${detail}`)
    }
  })
}

function recordsFromColumnarObject(obj: Record<string, unknown>): Record<string, unknown>[] | null {
  const keys = Object.keys(obj)
  if (keys.length === 0) return null

  const arrays = keys.filter((key) => Array.isArray(obj[key]))
  if (arrays.length !== keys.length) return null

  const length = (obj[arrays[0]] as unknown[]).length
  if (length === 0) return []

  const sameLength = arrays.every((key) => (obj[key] as unknown[]).length === length)
  if (!sameLength) return null

  return Array.from({ length }, (_, index) => {
    const row: Record<string, unknown> = {}
    for (const key of keys) {
      row[key] = (obj[key] as unknown[])[index]
    }
    return row
  })
}

function unwrapRecordArray(obj: Record<string, unknown>): Record<string, unknown>[] | null {
  const candidates = Object.values(obj).filter(isRecordArray)
  if (candidates.length === 0) return null

  return candidates.reduce((best, current) => (current.length > best.length ? current : best))
}

function recordsFromParsed(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return []
    if (isRecordArray(parsed)) return parsed
    return parsed.map((value) => ({ value }))
  }

  if (isObjectRecord(parsed)) {
    const unwrapped = unwrapRecordArray(parsed)
    if (unwrapped) return unwrapped

    const columnar = recordsFromColumnarObject(parsed)
    if (columnar) return columnar

    return [parsed]
  }

  throw new Error('Unsupported JSON structure — expected an array of objects or an object wrapping one')
}

export function parseJsonToRecords(text: string): Record<string, unknown>[] {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('JSON file is empty')
  }

  try {
    return recordsFromParsed(JSON.parse(trimmed))
  } catch (error) {
    if (error instanceof SyntaxError) {
      return parseJsonLines(trimmed)
    }
    throw error
  }
}

/** Flatten common JSON shapes into JSONL for DuckDB tabular import. */
export function normalizeJsonForImport(
  text: string,
  fileName: string,
): { buffer: ArrayBuffer; registerName: string } {
  const records = parseJsonToRecords(text)
  if (records.length === 0) {
    throw new Error('JSON file contains no records')
  }

  const jsonl = records.map((record) => JSON.stringify(record)).join('\n')
  const registerName = fileName.replace(/\.(json|jsonl|ndjson)$/i, '.jsonl')

  return {
    buffer: new TextEncoder().encode(jsonl).buffer as ArrayBuffer,
    registerName,
  }
}
