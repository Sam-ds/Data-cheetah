import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useSqlStore } from '@/features/sql/store/sqlStore'
import { useFilesStore } from '@/features/files/store/filesStore'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { saveQuery } from '@/services/storageService'
import { generateId } from '@/lib/utils/sanitizeTableName'
import { Button } from '@/components/ui/button'
import {
  registerSqlCompletionProvider,
  snapshotFromFiles,
} from '@/features/sql/services/sqlCompletionProvider'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

interface SqlEditorProps {
  onRun?: () => void
}

export function SqlEditor({ onRun }: SqlEditorProps) {
  const { editorContent, setEditorContent, diagnostics } = useSqlStore()
  const theme = usePreferencesStore((s) => s.theme)
  const files = useFilesStore((s) => s.files)
  const activeFile = useFilesStore((s) => s.getActiveFile())
  const [naming, setNaming] = useState(false)
  const [queryName, setQueryName] = useState('')
  const [saving, setSaving] = useState(false)

  const filesRef = useRef(files)
  filesRef.current = files
  const completionDisposable = useRef<{ dispose: () => void } | null>(null)

  useEffect(() => {
    return () => {
      completionDisposable.current?.dispose()
      completionDisposable.current = null
    }
  }, [])

  const startSave = () => {
    if (!editorContent.trim()) {
      toast.error('Write a query before saving')
      return
    }
    const defaultName = activeFile
      ? `Query on ${activeFile.tableName}`
      : `Query ${new Date().toLocaleTimeString()}`
    setQueryName(defaultName)
    setNaming(true)
  }

  const confirmSave = async () => {
    if (!queryName.trim()) {
      toast.error('Enter a name for the query')
      return
    }
    setSaving(true)
    try {
      await saveQuery({
        id: generateId(),
        name: queryName.trim(),
        sql: editorContent,
        tableName: activeFile?.tableName ?? '',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      toast.success(`Saved “${queryName.trim()}”`)
      setNaming(false)
      setQueryName('')
    } catch {
      toast.error('Failed to save query')
    } finally {
      setSaving(false)
    }
  }

  const ensureCompletions = (monaco: typeof import('monaco-editor')) => {
    if (completionDisposable.current) return
    completionDisposable.current = registerSqlCompletionProvider(monaco, () =>
      snapshotFromFiles(filesRef.current),
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header gap-2">
        <span className="shrink-0">SQL Editor</span>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 normal-case tracking-normal">
          {naming ? (
            <>
              <input
                autoFocus
                className="h-6 max-w-[200px] flex-1 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                value={queryName}
                placeholder="Query name"
                onChange={(e) => setQueryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void confirmSave()
                  if (e.key === 'Escape') setNaming(false)
                }}
              />
              <Button size="sm" className="h-6 px-2 text-xs" onClick={() => void confirmSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setNaming(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-xs"
              onClick={startSave}
              title="Save current query"
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
          )}
        </div>
      </div>
      <div className="relative flex-1">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <MonacoEditor
            height="100%"
            language="sql"
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            value={editorContent}
            onChange={(value) => setEditorContent(value ?? '')}
            beforeMount={(monaco) => {
              ensureCompletions(monaco)
            }}
            onMount={(editor, monaco) => {
              ensureCompletions(monaco)
              editor.addAction({
                id: 'run-query',
                label: 'Run Query',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                run: () => onRun?.(),
              })
            }}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8 },
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              quickSuggestions: {
                other: true,
                comments: false,
                strings: false,
              },
              suggestOnTriggerCharacters: true,
              wordBasedSuggestions: 'off',
              tabCompletion: 'on',
            }}
          />
        </Suspense>
        {diagnostics.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 border-t bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            {diagnostics[0].message}
          </div>
        )}
      </div>
    </div>
  )
}
