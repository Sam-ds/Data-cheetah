import { Check, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatBytes } from '@/lib/utils/sanitizeTableName'
import type { RegisteredDataset } from '@/types/dataset'

interface FileListItemProps {
  file: RegisteredDataset
  isActive: boolean
  onClick: () => void
}

function hasMetadata(file: RegisteredDataset): boolean {
  const doc = file.schemaDoc
  if (!doc) return false
  if (doc.description?.trim() || doc.grain?.trim() || doc.notes?.trim()) return true
  if (doc.relationships?.length || doc.exampleQuestions?.length) return true
  if (doc.columns) {
    return Object.values(doc.columns).some((c) => Boolean(c.description?.trim()))
  }
  return false
}

export function FileListItem({ file, isActive, onClick }: FileListItemProps) {
  const meta = hasMetadata(file)

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent',
        isActive && 'bg-accent text-accent-foreground',
      )}
    >
      <FileSpreadsheet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate font-medium">
          <span className="truncate">{file.fileName}</span>
          {meta && (
            <span
              className="shrink-0 rounded bg-[rgba(242,160,31,0.15)] px-1 py-px text-[9px] font-medium text-[#b45309] dark:text-[#f2a01f]"
              title="Table metadata attached"
            >
              meta
            </span>
          )}
        </div>
        <div className="text-muted-foreground">
          {file.rowCount.toLocaleString()} rows · {file.schema.length} cols · {formatBytes(file.fileSize)}
        </div>
      </div>
      {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
    </button>
  )
}
