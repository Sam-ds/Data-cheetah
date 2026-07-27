import { useProfileStore } from '@/features/profiling/store/profileStore'
import { ColumnStats } from './ColumnStats'
import { BarChart3, Loader2 } from 'lucide-react'

interface ProfilePanelProps {
  embedded?: boolean
}

export function ProfilePanel({ embedded = false }: ProfilePanelProps) {
  const { profile, isLoading } = useProfileStore()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {!embedded && (
        <div className="panel-header">
          <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
          Statistics
        </div>
      )}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !profile ? (
        <div className="flex flex-1 items-center justify-center p-4 text-xs text-muted-foreground">
          Load a file to see column statistics
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">
            {profile.rowCount.toLocaleString()} rows · {profile.columnCount} columns
            {profile.duplicateCount != null && profile.duplicateCount > 0 && (
              <span className="ml-2 text-amber-600">
                {profile.duplicateCount.toLocaleString()} duplicates
              </span>
            )}
          </div>
          {profile.columns.map((col) => (
            <ColumnStats key={col.columnName} profile={col} />
          ))}
        </div>
      )}
    </div>
  )
}
