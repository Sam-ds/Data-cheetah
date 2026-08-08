import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExportNameDialogProps {
  open: boolean
  format: 'csv' | 'xlsx' | 'json' | 'parquet' | null
  defaultName?: string
  onOpenChange: (open: boolean) => void
  onConfirm: (fileName: string) => void
}

const EXT: Record<NonNullable<ExportNameDialogProps['format']>, string> = {
  csv: 'csv',
  xlsx: 'xlsx',
  json: 'json',
  parquet: 'parquet',
}

const FORMAT_LABEL: Record<NonNullable<ExportNameDialogProps['format']>, string> = {
  csv: 'CSV',
  xlsx: 'Excel',
  json: 'JSON',
  parquet: 'Parquet',
}

/** Strip path chars and ensure the correct extension. */
export function normalizeExportFileName(
  raw: string,
  format: keyof typeof EXT,
  fallback = 'export',
): string {
  const ext = EXT[format]
  let base = raw.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').replace(/\.+$/, '')
  if (!base) base = fallback
  const lower = base.toLowerCase()
  if (lower.endsWith(`.${ext}`)) return base
  // Drop a wrong extension the user typed, then append the right one
  const withoutExt = base.replace(/\.[^.]+$/, '')
  return `${withoutExt || fallback}.${ext}`
}

export function ExportNameDialog({
  open,
  format,
  defaultName = 'export',
  onOpenChange,
  onConfirm,
}: ExportNameDialogProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(defaultName)

  useEffect(() => {
    if (!open || !format) return
    const ext = EXT[format]
    const base = defaultName.replace(/\.[^.]+$/, '') || 'export'
    setName(`${base}.${ext}`)
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open, format, defaultName])

  if (!open || !format) return null

  const submit = () => {
    const fileName = normalizeExportFileName(name, format, defaultName.replace(/\.[^.]+$/, '') || 'export')
    onConfirm(fileName)
    onOpenChange(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id={`${inputId}-title`} className="text-sm font-semibold">
            Export {FORMAT_LABEL[format]}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 p-4">
          <label htmlFor={inputId} className="block text-xs text-muted-foreground">
            File name
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') onOpenChange(false)
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={!name.trim()}>
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
