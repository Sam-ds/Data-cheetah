import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { useQueryStore } from '@/features/sql/store/sqlStore'
import { useFilesStore } from '@/features/files/store/filesStore'
import { formatDuration } from '@/lib/utils/sanitizeTableName'
import { Shield, Circle } from 'lucide-react'

export function StatusBar() {
  const duckdbReady = usePreferencesStore((s) => s.duckdbReady)
  const result = useQueryStore((s) => s.result)
  const error = useQueryStore((s) => s.error)
  const activeFile = useFilesStore((s) => s.getActiveFile())

  return (
    <footer className="flex h-[22px] shrink-0 items-center gap-3 border-t bg-muted/50 px-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <Circle
          className={`h-2 w-2 fill-current ${duckdbReady ? 'text-green-500' : 'text-amber-500'}`}
        />
        DuckDB {duckdbReady ? 'ready' : 'loading...'}
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
