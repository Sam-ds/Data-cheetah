import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import { Loader2 } from 'lucide-react'

ModuleRegistry.registerModules([AllCommunityModule])

interface PreviewGridProps {
  rows: Record<string, unknown>[]
  loading?: boolean
}

export function PreviewGrid({ rows, loading }: PreviewGridProps) {
  const columnDefs = useMemo(() => {
    if (rows.length === 0) return []
    return Object.keys(rows[0]).map((key) => ({
      field: key,
      headerName: key,
      minWidth: 80,
      valueFormatter: (params: { value: unknown }) => (params.value == null ? '' : String(params.value)),
    }))
  }, [rows])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (rows.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No preview data</p>
  }

  return (
    <div className="ag-theme-quartz h-full w-full">
      <AgGridReact rowData={rows} columnDefs={columnDefs} defaultColDef={{ flex: 1 }} suppressCellFocus />
    </div>
  )
}
