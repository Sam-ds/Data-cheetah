import * as XLSX from 'xlsx'
import type { QueryResult } from '@/types/query'

export function exportToCsv(result: QueryResult, fileName = 'export.csv'): void {
  const { columns, rows } = result
  const header = columns.join(',')
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col]
          if (val == null) return ''
          const str = String(val)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(','),
    )
    .join('\n')

  downloadBlob(new Blob([`${header}\n${body}`], { type: 'text/csv' }), fileName)
}

export function exportToXlsx(result: QueryResult, fileName = 'export.xlsx'): void {
  const worksheet = XLSX.utils.json_to_sheet(result.rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
  XLSX.writeFile(workbook, fileName)
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  mime = 'application/octet-stream',
): void {
  downloadBlob(new Blob([new Uint8Array(buffer)], { type: mime }), fileName)
}
