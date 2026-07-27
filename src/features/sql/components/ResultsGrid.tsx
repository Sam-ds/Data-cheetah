import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { useQueryStore } from '@/features/sql/store/sqlStore'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { Table2 } from 'lucide-react'
import { formatDuration } from '@/lib/utils/sanitizeTableName'

ModuleRegistry.registerModules([AllCommunityModule])

interface ResultsGridProps {
  embedded?: boolean
}

export function ResultsGrid({ embedded = false }: ResultsGridProps) {
  const { result, error } = useQueryStore()
  const theme = usePreferencesStore((s) => s.theme)

  const columnDefs = useMemo(() => {
    if (!result) return []
    return result.columns.map((col) => ({
      field: col,
      headerName: col,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 100,
      valueFormatter: (params: { value: unknown }) => {
        if (params.value == null) return ''
        if (typeof params.value === 'object') return JSON.stringify(params.value)
        return String(params.value)
      },
    }))
  }, [result])

  return (
    <div className="flex h-full flex-col">
      {!embedded ? (
        <div className="panel-header flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Table2 className="h-3.5 w-3.5" />
            Results
          </span>
          {result && (
            <span className="normal-case tracking-normal text-muted-foreground">
              {result.rows.length.toLocaleString()} rows · {formatDuration(result.durationMs)}
            </span>
          )}
        </div>
      ) : (
        result && (
          <div className="flex h-7 items-center justify-end border-b px-3 text-[11px] text-muted-foreground">
            {result.rows.length.toLocaleString()} rows · {formatDuration(result.durationMs)}
          </div>
        )
      )}
      <div className="flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-destructive">{error}</div>
        ) : !result ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Run a query to see results
          </div>
        ) : (
          <div className={`ag-theme-quartz h-full w-full ${theme === 'dark' ? 'ag-theme-quartz-dark' : ''}`}>
            <AgGridReact
              rowData={result.rows}
              columnDefs={columnDefs}
              defaultColDef={{ flex: 1 }}
              animateRows={false}
              rowBuffer={20}
              suppressCellFocus
            />
          </div>
        )}
      </div>
    </div>
  )
}
