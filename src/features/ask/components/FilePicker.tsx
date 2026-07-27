import { useRef } from 'react'
import { Download, FileUp, X } from 'lucide-react'
import type { RegisteredDataset } from '@/types/dataset'
import { Button } from '@/components/ui/button'
import {
  downloadWorkspaceSchemaDocDraft,
  readSchemaDocFromFile,
} from '@/features/files/services/schemaDocService'
import type { TableSchemaDoc } from '@/types/schemaDoc'
import { toast } from 'sonner'

interface FilePickerProps {
  files: RegisteredDataset[]
  selectedFileIds: string[]
  onToggle: (id: string) => void
  onAttachSchemaDocs: (docs: TableSchemaDoc[]) => { attached: string[]; missed: string[] }
  onClearAllSchemaDocs: () => void
  disabled?: boolean
}

export function FilePicker({
  files,
  selectedFileIds,
  onToggle,
  onAttachSchemaDocs,
  onClearAllSchemaDocs,
  disabled,
}: FilePickerProps) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const describedCount = files.filter((f) => f.schemaDoc).length

  if (files.length === 0) {
    return <p className="text-xs text-muted-foreground">Open a file to ask questions.</p>
  }

  const downloadDraft = () => {
    try {
      downloadWorkspaceSchemaDocDraft(files)
      toast.success('Downloaded datacheetah.schema.json — fill descriptions, then upload it back')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build template')
    }
  }

  const handleUpload = async (file: File) => {
    try {
      const docs = await readSchemaDocFromFile(file)
      const { attached, missed } = onAttachSchemaDocs(docs)
      if (attached.length) {
        toast.success(
          `Descriptions applied to ${attached.length} table${attached.length === 1 ? '' : 's'}: ${attached.join(', ')}`,
        )
      }
      if (missed.length) {
        toast.error(`No match for: ${missed.join(', ')}. Check the "table" names.`)
      }
      if (!attached.length && !missed.length) {
        toast.error('No table descriptions found in that file')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid schema file')
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Ask over files
      </p>

      <div className="rounded-md border border-border/60 bg-muted/20 p-2 space-y-2">
        <p className="text-[10px] leading-snug text-muted-foreground">
          Optional: one <code className="text-[10px]">datacheetah.schema.json</code> for all
          tables. Download a fill-in draft from your loaded tables, edit descriptions, upload
          once.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            disabled={disabled}
            onClick={downloadDraft}
          >
            <Download className="h-3 w-3" />
            Download fill-in file
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            disabled={disabled}
            onClick={() => uploadRef.current?.click()}
          >
            <FileUp className="h-3 w-3" />
            Upload descriptions
          </Button>
          {describedCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
              disabled={disabled}
              onClick={onClearAllSchemaDocs}
            >
              <X className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          accept=".json,.schema.json,application/json"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void handleUpload(f)
          }}
        />
        {describedCount > 0 && (
          <p className="text-[10px] text-[#b45309] dark:text-[#f2a01f]">
            Descriptions on {describedCount}/{files.length} table{files.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <ul className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
        {files.map((file) => {
          const checked = selectedFileIds.includes(file.id)
          const hasDoc = Boolean(file.schemaDoc)
          return (
            <li key={file.id}>
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(file.id)}
                />
                <span>
                  <span className="font-medium text-foreground">{file.fileName}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    table &quot;{file.tableName}&quot; · {file.schema.length} cols
                    {hasDoc ? ' · described' : ''}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
