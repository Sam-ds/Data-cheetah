import { useEffect, useId, useRef } from 'react'
import { Box, Lock, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface JsPackRiskInfo {
  name: string
  publisher: string
  version?: string
}

interface JsPackRiskDialogProps {
  open: boolean
  pack: JsPackRiskInfo | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function JsPackRiskDialog({
  open,
  pack,
  onOpenChange,
  onConfirm,
}: JsPackRiskDialogProps) {
  const titleId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => confirmRef.current?.focus(), 0)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  if (!open || !pack) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="relative border-b border-amber-500/20 bg-gradient-to-br from-amber-500/12 via-background to-background px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pr-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700/90 dark:text-amber-300/90">
                Third-party JavaScript
              </p>
              <h2 id={titleId} className="mt-1 text-base font-semibold tracking-tight text-foreground">
                Install this interactive pack?
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                DataCheetah has not verified this code. Review the sandbox limits before you continue.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 shrink-0 text-[var(--brand)]" aria-hidden />
              <p className="truncate text-sm font-semibold text-foreground">{pack.name}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Publisher <span className="font-medium text-foreground">{pack.publisher}</span>
              {pack.version ? (
                <>
                  {' · '}Version <span className="font-medium text-foreground">{pack.version}</span>
                </>
              ) : null}
            </p>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">Contains visualization.js</p>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Sandbox protections
            </div>
            <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                Runs only in a restricted iframe — no access to DataCheetah UI or storage
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                Can read only the columns you map into the pack
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                Network requests and cookies are blocked by the sandbox
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-3.5">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            size="sm"
            className="gap-1.5 bg-amber-600 text-white hover:bg-amber-600/90 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            Install at my own risk
          </Button>
        </div>
      </div>
    </div>
  )
}
