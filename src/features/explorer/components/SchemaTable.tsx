import type { ColumnSchema } from '@/types/dataset'
import { Loader2 } from 'lucide-react'

interface SchemaTableProps {
  schema: ColumnSchema[]
  loading?: boolean
}

export function SchemaTable({ schema, loading }: SchemaTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (schema.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No schema available</p>
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-2 pr-4 font-medium">Column</th>
          <th className="pb-2 font-medium">Type</th>
        </tr>
      </thead>
      <tbody>
        {schema.map((col) => (
          <tr key={col.name} className="border-b border-border/50">
            <td className="py-1.5 pr-4 font-mono">{col.name}</td>
            <td className="py-1.5 text-muted-foreground">{col.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
