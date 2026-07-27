import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { useQueryStore } from '@/features/sql/store/sqlStore'
import { useFilesStore } from '@/features/files/store/filesStore'
import { formatDuration } from '@/lib/utils/sanitizeTableName'
import { hasSeenDuckDBEngine } from '@/hooks/useDuckDB'
import { Shield, Circle } from 'lucide-react'

export function StatusBar() {
  const duckdbStatus = usePreferencesStore((s) => s.duckdbStatus)
  const result = useQueryStore((s) => s.result)
  const error = useQueryStore((s) => s.error)
  const activeFile = useFilesStore((s) => s.getActiveFile())
  const seenEngine = hasSeenDuckDBEngine()

  const duckdbLabel =
    duckdbStatus === 'ready'
      ? 'DuckDB ready'
      : duckdbStatus === 'loading'
        ? seenEngine
          ? 'Starting SQL engine…'
          : 'Downloading SQL engine…'
        : duckdbStatus === 'error'
          ? 'DuckDB failed'
          : 'DuckDB on demand'

  const duckdbColor =
    duckdbStatus === 'ready'
      ? 'text-green-500'
      : duckdbStatus === 'loading'
        ? 'text-amber-500'
        : duckdbStatus === 'error'
          ? 'text-destructive'
          : 'text-muted-foreground'

  return (
    <footer className="flex h-[22px] shrink-0 items-center gap-3 border-t bg-muted/50 px-3 text-[11px] text-muted-foreground">
      <span
        className="flex items-center gap-1"
        title="SQL engine loads in your browser only when you open a file"
      >
        <Circle className={`h-2 w-2 fill-current ${duckdbColor}`} />
        {duckdbLabel}
      </span>

      {activeFile && (
        <span>
          {activeFile.fileName} · {activeFile.rowCount.toLocaleString()} rows
        </span>
      )}

      {result && !error && (
        <span>
          {result.rows.length.toLocaleString()} results · {formatDuration(result.durationMs)}
        </span>
      )}

      {error && <span className="text-destructive truncate max-w-md">{error}</span>}

      <span className="ml-auto flex items-center gap-1">
        <Shield className="h-3 w-3" />
        Local only — no data uploaded
      </span>
    </footer>
  )
}
