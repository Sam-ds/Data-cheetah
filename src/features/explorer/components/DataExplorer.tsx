import { useDataExplorer } from '@/features/explorer/hooks/useDataExplorer'
import { SchemaTable } from './SchemaTable'
import { PreviewGrid } from './PreviewGrid'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Compass } from 'lucide-react'

interface DataExplorerProps {
  embedded?: boolean
}

export function DataExplorer({ embedded = false }: DataExplorerProps) {
  const { activeFile, preview, schema, loading } = useDataExplorer()

  if (!activeFile) {
    return (
      <div className="flex h-full flex-col">
        {!embedded && (
          <div className="panel-header">
            <Compass className="mr-1.5 h-3.5 w-3.5" />
            Explorer
          </div>
        )}
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Load a file to explore
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {!embedded && (
        <div className="panel-header">
          <Compass className="mr-1.5 h-3.5 w-3.5" />
          Explorer
        </div>
      )}
      <div className="border-b px-3 py-2">
        <div className="truncate text-sm font-medium">{activeFile.fileName}</div>
        <div className="text-xs text-muted-foreground">
          {activeFile.rowCount.toLocaleString()} rows · {activeFile.schema.length} columns ·{' '}
          {activeFile.format.toUpperCase()}
        </div>
      </div>
      <Tabs defaultValue="schema" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-2 mt-2 w-fit">
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="schema" className="flex-1 overflow-auto p-2">
          <SchemaTable schema={schema} loading={loading} />
        </TabsContent>
        <TabsContent value="preview" className="flex-1 overflow-hidden p-2">
          <PreviewGrid rows={preview} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
