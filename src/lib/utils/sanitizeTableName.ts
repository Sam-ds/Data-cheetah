export function sanitizeTableName(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, '')
  const sanitized = base
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()

  return sanitized || 'dataset'
}

export function detectFormat(fileName: string): 'csv' | 'parquet' | 'json' | 'xlsx' | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'csv':
    case 'tsv':
      return 'csv'
    case 'parquet':
      return 'parquet'
    case 'json':
    case 'jsonl':
    case 'ndjson':
      return 'json'
    case 'xlsx':
    case 'xls':
      return 'xlsx'
    default:
      return null
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function generateId(): string {
  return crypto.randomUUID()
}

export const SUPPORTED_EXTENSIONS = ['.csv', '.tsv', '.parquet', '.json', '.jsonl', '.ndjson', '.xlsx', '.xls']

export function isSupportedFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}
