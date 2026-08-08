import Papa from 'papaparse'
import type { SchemaPlan } from './schemaPlan'
import { generateSyntheticRow } from './generateSynthetic'

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

type WritableFile = {
  write(data: string): Promise<void>
  close(): Promise<void>
  abort?(): Promise<void>
}

type SaveFilePicker = (options: {
  suggestedName: string
  types: Array<{ description: string; accept: Record<string, string[]> }>
}) => Promise<{ createWritable(): Promise<WritableFile> }>

function csvCell(value: unknown): string {
  if (value == null) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Stream very large CSV exports directly to disk without building a giant Blob. */
export async function streamPlanToCsv(
  plan: SchemaPlan,
  totalRows: number,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker
  if (!picker) {
    throw new Error('Large CSV export requires Chrome or Edge with file saving support.')
  }

  const handle = await picker({
    suggestedName: 'synthetic_data.csv',
    types: [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }],
  })
  const writable = await handle.createWritable()
  const columns = plan.columns.map((column) => column.name)
  const chunkSize = 5_000

  try {
    await writable.write(`${columns.map(csvCell).join(',')}\r\n`)
    for (let start = 0; start < totalRows; start += chunkSize) {
      const end = Math.min(totalRows, start + chunkSize)
      const lines = new Array<string>(end - start)
      for (let index = start; index < end; index += 1) {
        const row = generateSyntheticRow(plan, index)
        lines[index - start] = columns.map((column) => csvCell(row[column])).join(',')
      }
      await writable.write(`${lines.join('\r\n')}\r\n`)
      onProgress?.(end, totalRows)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    await writable.close()
  } catch (error) {
    await writable.abort?.()
    throw error
  }
}
