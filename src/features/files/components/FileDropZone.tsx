import { cn } from '@/lib/utils/cn'
import { useFileImport } from '@/features/files/hooks/useFileImport'
import { Upload, Loader2 } from 'lucide-react'

interface FileDropZoneProps {
  className?: string
  compact?: boolean
}

export function FileDropZone({ className, compact = false }: FileDropZoneProps) {
  const { handleDrop, handleFileInput, importStatus } = useFileImport()
  const isLoading = importStatus === 'loading'

  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary/50 hover:bg-muted/50',
        compact ? 'px-4 py-3' : 'px-8 py-10',
        isLoading && 'pointer-events-none opacity-60',
        className,
      )}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input type="file" className="hidden" accept=".csv,.tsv,.parquet,.json,.jsonl,.xlsx,.xls" onChange={handleFileInput} />
      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      ) : (
        <Upload className={cn('text-muted-foreground', compact ? 'h-5 w-5' : 'h-8 w-8')} />
      )}
      <p className={cn('mt-2 font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>
        {isLoading ? 'Loading dataset...' : 'Drop file here or click to browse'}
      </p>
      {!compact && (
        <p className="mt-1 text-xs text-muted-foreground">CSV, Parquet, JSON, Excel (.xlsx)</p>
      )}
    </label>
  )
}
