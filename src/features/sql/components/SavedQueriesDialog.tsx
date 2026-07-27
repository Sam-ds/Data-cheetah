import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useSqlStore } from '@/features/sql/store/sqlStore'
import { useFilesStore } from '@/features/files/store/filesStore'
import { getSavedQueries, saveQuery, deleteSavedQuery } from '@/services/storageService'
import { generateId } from '@/lib/utils/sanitizeTableName'
import type { SavedQuery } from '@/types/query'
import { X, Trash2, Plus } from 'lucide-react'

interface SavedQueriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SavedQueriesDialog({ open, onOpenChange }: SavedQueriesDialogProps) {
  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [name, setName] = useState('')
  const setEditorContent = useSqlStore((s) => s.setEditorContent)
  const editorContent = useSqlStore((s) => s.editorContent)
  const activeFile = useFilesStore((s) => s.getActiveFile())

  useEffect(() => {
    if (open) {
      getSavedQueries().then(setQueries)
    }
  }, [open])

  const handleSave = async () => {
    if (!name.trim()) return
    const query: SavedQuery = {
      id: generateId(),
      name: name.trim(),
      sql: editorContent,
      tableName: activeFile?.tableName ?? '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await saveQuery(query)
    setQueries(await getSavedQueries())
    setName('')
  }

  const handleLoad = (query: SavedQuery) => {
    setEditorContent(query.sql)
    onOpenChange(false)
  }

  const handleDelete = async (id: string) => {
    await deleteSavedQuery(id)
    setQueries(await getSavedQueries())
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Saved Queries</h2>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 border-b p-4">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Query name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button size="sm" onClick={handleSave}>
            <Plus className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {queries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No saved queries yet</p>
          ) : (
            queries.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent"
              >
                <button className="flex-1 text-left" onClick={() => handleLoad(q)}>
                  <div className="text-sm font-medium">{q.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{q.sql.slice(0, 80)}</div>
                </button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
