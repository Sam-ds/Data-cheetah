import { useEffect, useRef, useState } from 'react'
import { Download, FileJson, FileUp, FolderOpen, Loader2, RotateCcw, Upload } from 'lucide-react'
import { useFileImport } from '@/features/files/hooks/useFileImport'
import { FileListItem } from './FileListItem'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import {
  hasPersistedDatasets,
  rehydratePersistedFiles,
} from '@/features/files/services/localDatasetService'
import { downloadWorkspaceSchemaDocDraft } from '@/features/files/services/schemaDocService'
import { toast } from 'sonner'

export function FileSidebar() {
  const {
    files,
    activeFileId,
    setActiveFile,
    handleDrop,
    handleFileInput,
    handleFolderInput,
    handleFiles,
    importStatus,
  } = useFileImport()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const schemaInputRef = useRef<HTMLInputElement>(null)
  const duckdbStatus = usePreferencesStore((s) => s.duckdbStatus)
  const busy = importStatus === 'loading' || duckdbStatus === 'loading'
  const [dragging, setDragging] = useState(false)
  const [hasLocal, setHasLocal] = useState(false)

  const onDownloadMetadataSample = () => {
    try {
      downloadWorkspaceSchemaDocDraft(files)
      toast.success('Downloaded datacheetah.schema.json — edit descriptions, then upload')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download sample')
    }
  }

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
        <FolderOpen className="mr-1.5 h-3.5 w-3.5 text-[#f2a01f]" />
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
          <input
            ref={(el) => {
              folderInputRef.current = el
              if (el) {
                el.setAttribute('webkitdirectory', '')
                el.setAttribute('directory', '')
              }
            }}
            type="file"
            className="hidden"
            multiple
            onChange={handleFolderInput}
          />
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#f2a01f]" />
          ) : (
            <Upload className="h-4 w-4 text-[#f2a01f]" />
          )}
          <p className="mt-1.5 text-[10px] font-medium text-foreground">
            {busy ? 'Loading locally…' : 'Drop files or a folder'}
          </p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">
            Stays on this device · CSV · Parquet · JSON · Excel
          </p>
        </label>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[10px]"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-3 w-3" />
            Files
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[10px]"
            disabled={busy}
            onClick={() => folderInputRef.current?.click()}
            title="Read a local folder in the browser. Nothing is uploaded to a server."
          >
            <FolderOpen className="h-3 w-3 text-[#f2a01f]" />
            Folder
          </Button>
        </div>
        <p className="mt-1.5 px-0.5 text-center text-[9px] leading-relaxed text-muted-foreground">
          Folder load is client-only. Files never leave your machine.
        </p>
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

      <div className="flex min-h-0 flex-1 flex-col">
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

        {files.length > 0 && (
          <div className="border-t border-border/50 p-2">
            <p className="mb-1.5 px-0.5 text-[10px] font-medium text-foreground">Table metadata</p>
            <p className="mb-2 px-0.5 text-[9px] leading-relaxed text-muted-foreground">
              After tables are loaded, download one fill-in file for all tables, edit descriptions,
              then upload it back. Helps Insights and Ask write better SQL.
            </p>
            <input
              ref={schemaInputRef}
              type="file"
              className="hidden"
              accept=".json,application/json"
              onChange={(e) => {
                const list = e.target.files
                if (!list?.length) return
                const schemaFiles = Array.from(list).map((f) =>
                  /\.schema\.json$/i.test(f.name)
                    ? f
                    : new File([f], f.name.replace(/\.json$/i, '.schema.json'), {
                        type: 'application/json',
                      }),
                )
                void handleFiles(schemaFiles)
                e.target.value = ''
              }}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[10px]"
                disabled={busy}
                onClick={onDownloadMetadataSample}
                title="Download datacheetah.schema.json pre-filled with your table and column names"
              >
                <Download className="h-3 w-3" />
                Sample file
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[10px]"
                disabled={busy}
                onClick={() => schemaInputRef.current?.click()}
                title="Upload an edited *.schema.json to attach descriptions"
              >
                <FileJson className="h-3 w-3" />
                Upload
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
