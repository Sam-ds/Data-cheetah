import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, PackagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DISCOVER_PACK_TIP } from '../content/discoverCopy'

interface DiscoverPackTipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenDevelopers: () => void
}

export function DiscoverPackTipDialog({
  open,
  onOpenChange,
  onOpenDevelopers,
}: DiscoverPackTipDialogProps) {
  const titleId = useId()
  const dismissRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => dismissRef.current?.focus(), 0)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
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
        <div className="relative border-b border-sky-500/20 bg-gradient-to-br from-sky-500/12 via-background to-background px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300">
              <PackagePlus className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pr-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700/90 dark:text-sky-300/90">
                {DISCOVER_PACK_TIP.eyebrow}
              </p>
              <h2 id={titleId} className="mt-1 text-base font-semibold tracking-tight text-foreground">
                {DISCOVER_PACK_TIP.title}
              </h2>
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

        <div className="space-y-3 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
          {DISCOVER_PACK_TIP.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p>
            For authoring details and the Open Dashboard contract, open{' '}
            <span className="font-medium text-foreground">For developers</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-3.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              onOpenChange(false)
              onOpenDevelopers()
            }}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            {DISCOVER_PACK_TIP.developersCta}
          </Button>
          <Button ref={dismissRef} size="sm" onClick={() => onOpenChange(false)}>
            {DISCOVER_PACK_TIP.dismissCta}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
