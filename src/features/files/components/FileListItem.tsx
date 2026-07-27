import { FileSpreadsheet, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatBytes } from '@/lib/utils/sanitizeTableName'
import type { RegisteredDataset } from '@/types/dataset'

interface FileListItemProps {
  file: RegisteredDataset
  isActive: boolean
  onClick: () => void
}

export function FileListItem({ file, isActive, onClick }: FileListItemProps) {
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
        <div className="flex items-center gap-1 truncate font-medium">{file.fileName}</div>
        <div className="text-muted-foreground">
          {file.rowCount.toLocaleString()} rows · {file.schema.length} cols · {formatBytes(file.fileSize)}
        </div>
      </div>
      {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
    </button>
  )
}
