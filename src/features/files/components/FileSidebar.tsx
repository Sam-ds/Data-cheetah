import { useRef, useState } from 'react'
import { FileUp, Loader2, RotateCcw, Upload } from 'lucide-react'
import { useFileImport } from '@/features/files/hooks/useFileImport'
import { FileListItem } from './FileListItem'
import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import {
  hasPersistedDatasets,
  rehydratePersistedFiles,
} from '@/features/files/services/localDatasetService'
import { useEffect } from 'react'
import { toast } from 'sonner'

export function FileSidebar() {
  const { files, activeFileId, setActiveFile, handleDrop, handleFileInput, importStatus } =
    useFileImport()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const duckdbStatus = usePreferencesStore((s) => s.duckdbStatus)
  const busy = importStatus === 'loading' || duckdbStatus === 'loading'
  const [dragging, setDragging] = useState(false)
  const [hasLocal, setHasLocal] = useState(false)

  useEffect(() => {
    void hasPersistedDatasets().then(setHasLocal).catch(() => setHasLocal(false))
  }, [files.length])

  const onRestore = async () => {
    try {
      const n = await rehydratePersistedFiles({ force: true })
      if (n > 0) toast.success(`Restored ${n} local dataset${n === 1 ? '' : 's'}`)
      else {
        toast.message('No cached datasets in this workspace')
        setHasLocal(false)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restore failed')
    }
  }

  return (
    <div className="flex h-full flex-col sidebar-bg">
      <div className="panel-header">
        <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
        Files
      </div>

      <div className="border-b border-border/50 p-2">
        <label
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-2 py-3 text-center transition',
            dragging
              ? 'border-[#f2a01f] bg-[rgba(242,160,31,0.1)]'
              : 'border-border/60 hover:border-[#f2a01f]/45 hover:bg-muted/40',
            busy && 'pointer-events-none opacity-60',
          )}
          onDrop={(e) => {
            setDragging(false)
            handleDrop(e)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.tsv,.parquet,.json,.jsonl,.xlsx,.xls,.schema.json"
            multiple
            onChange={handleFileInput}
          />
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#f2a01f]" />
          ) : (
            <Upload className="h-4 w-4 text-[#f2a01f]" />
          )}
          <p className="mt-1.5 text-[10px] font-medium text-foreground">
            {busy ? 'Loading…' : 'Drop file or browse'}
          </p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">CSV · Parquet · JSON · Excel</p>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 w-full gap-1 text-[10px]"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="h-3 w-3" />
          Open files
        </Button>
        {hasLocal && files.length === 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 w-full gap-1 text-[10px] text-muted-foreground"
            disabled={busy}
            onClick={() => void onRestore()}
          >
            <RotateCcw className="h-3 w-3" />
            Restore cached
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {files.length === 0 ? (
          <p className="px-2 py-3 text-center text-[10px] leading-relaxed text-muted-foreground">
            No files yet. Drop a dataset above to query it with SQL beside this panel.
          </p>
        ) : (
          <div className="space-y-0.5">
            {files.map((file) => (
              <FileListItem
                key={file.id}
                file={file}
                isActive={file.id === activeFileId}
                onClick={() => setActiveFile(file.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
