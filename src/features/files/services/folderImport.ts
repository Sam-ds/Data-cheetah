import { isSupportedFile } from '@/lib/utils/sanitizeTableName'
import { isSchemaDocFileName } from '@/features/files/services/schemaDocService'

/** Soft limit before we warn that a folder load may overwhelm the browser. */
export const FOLDER_SIZE_WARN_BYTES = 5 * 1024 * 1024 * 1024

const SKIP_DIR_PARTS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  '.venv',
  'venv',
  'dist',
  'build',
])

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let n = bytes
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < units.length - 1)
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function shouldSkipPath(relativePath: string): boolean {
  const parts = relativePath.split(/[/\\]/).filter(Boolean)
  return parts.some((p) => SKIP_DIR_PARTS.has(p.toLowerCase()) || p === '.' || p === '..')
}

/** Keep supported data + schema description files; drop junk paths. */
export function filterFolderImportFiles(files: File[]): {
  supported: File[]
  skipped: number
} {
  let skipped = 0
  const supported: File[] = []
  for (const file of files) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    if (shouldSkipPath(rel)) {
      skipped++
      continue
    }
    const base = file.name.split(/[/\\]/).pop() || file.name
    if (base.startsWith('.')) {
      skipped++
      continue
    }
    if (isSchemaDocFileName(base) || isSupportedFile(base)) {
      supported.push(file)
    } else {
      skipped++
    }
  }
  return { supported, skipped }
}

export function totalFileBytes(files: File[]): number {
  return files.reduce((sum, f) => sum + (typeof f.size === 'number' ? f.size : 0), 0)
}

/**
 * If folder payload is over 5 GB, warn and ask whether to continue.
 * Returns false when the user cancels.
 */
export function confirmLargeFolderLoad(files: File[]): boolean {
  const total = totalFileBytes(files)
  if (total <= FOLDER_SIZE_WARN_BYTES) return true
  return window.confirm(
    `These files total about ${formatBytes(total)} (over 5 GB).\n\n` +
      `Everything is processed only in your browser — nothing is uploaded to a server. ` +
      `A load this large may still freeze or crash the tab. Keep only the files you need, then try again.\n\n` +
      `Load all ${files.length.toLocaleString()} supported file${files.length === 1 ? '' : 's'} anyway?`,
  )
}

type FileSystemEntryLike = {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath?: string
}

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (ok: (file: File) => void, err?: (e: Error) => void) => void
}

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => {
    readEntries: (
      ok: (entries: FileSystemEntryLike[]) => void,
      err?: (e: Error) => void,
    ) => void
  }
}

async function readAllDirectoryEntries(
  reader: ReturnType<FileSystemDirectoryEntryLike['createReader']>,
): Promise<FileSystemEntryLike[]> {
  const all: FileSystemEntryLike[] = []
  for (;;) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (!batch.length) break
    all.push(...batch)
  }
  return all
}

async function walkEntry(entry: FileSystemEntryLike, out: File[]): Promise<void> {
  const path = entry.fullPath || entry.name
  if (shouldSkipPath(path)) return

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntryLike
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject))
    out.push(file)
    return
  }

  if (entry.isDirectory) {
    const dir = entry as FileSystemDirectoryEntryLike
    const children = await readAllDirectoryEntries(dir.createReader())
    for (const child of children) {
      await walkEntry(child, out)
    }
  }
}

/** Collect files from a drop that may include folders (Chrome/Edge). */
export async function collectFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = dataTransfer.items
  if (!items?.length) {
    return Array.from(dataTransfer.files ?? [])
  }

  const entries: FileSystemEntryLike[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const entry = (
      item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntryLike | null }
    ).webkitGetAsEntry?.()
    if (entry) entries.push(entry)
  }

  if (entries.length === 0) {
    return Array.from(dataTransfer.files ?? [])
  }

  const files: File[] = []
  for (const entry of entries) {
    await walkEntry(entry, files)
  }
  return files
}
