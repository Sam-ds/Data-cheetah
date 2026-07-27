import Papa from 'papaparse'

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  return Papa.unparse(rows)
}

export function rowsToJson(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows, null, 2)
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function rowsToFile(
  rows: Record<string, unknown>[],
  format: 'csv' | 'json',
  baseName = 'synthetic_data',
): File {
  if (format === 'json') {
    return new File([rowsToJson(rows)], `${baseName}.json`, { type: 'application/json' })
  }
  return new File([rowsToCsv(rows)], `${baseName}.csv`, { type: 'text/csv' })
}
