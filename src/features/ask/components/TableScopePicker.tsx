import type { RegisteredDataset } from '@/types/dataset'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface TableScopePickerProps {
  files: RegisteredDataset[]
  selectedFileIds: string[]
  onToggle: (id: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
  disabled?: boolean
  /** Compact chip row for the SQL ask bar */
  compact?: boolean
  className?: string
}

/** Choose which loaded tables Ask / Generate insights may use. */
export function TableScopePicker({
  files,
  selectedFileIds,
  onToggle,
  onSelectAll,
  onSelectNone,
  disabled,
  compact = false,
  className,
}: TableScopePickerProps) {
  if (files.length === 0) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Open a file to choose tables.
      </p>
    )
  }

  const selectedCount = selectedFileIds.filter((id) => files.some((f) => f.id === id)).length

  if (compact) {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Tables
        </span>
        {files.map((file) => {
          const checked = selectedFileIds.includes(file.id)
          return (
            <button
              key={file.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(file.id)}
              title={file.fileName}
              className={cn(
                'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                checked
                  ? 'border-[#f2a01f]/50 bg-[#f2a01f]/15 text-foreground'
                  : 'border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground',
                disabled && 'opacity-50',
              )}
            >
              {file.tableName}
            </button>
          )
        })}
        <span className="text-[10px] text-muted-foreground">
          {selectedCount}/{files.length}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Tables in scope
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={disabled || selectedCount === files.length}
            onClick={onSelectAll}
          >
            All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={disabled || selectedCount === 0}
            onClick={onSelectNone}
          >
            None
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Used for Generate insights and questions in the Ask bar ({selectedCount} selected).
      </p>
      <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-background/60 p-2">
        {files.map((file) => {
          const checked = selectedFileIds.includes(file.id)
          return (
            <li key={file.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(file.id)}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{file.tableName}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {file.fileName}
                    {file.rowCount != null ? ` · ${file.rowCount.toLocaleString()} rows` : ''}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
