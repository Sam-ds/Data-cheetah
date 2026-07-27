import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SHORTCUTS = [
  { keys: 'Ctrl + Enter', action: 'Run query' },
  { keys: 'Ctrl + Shift + F', action: 'Format SQL' },
]

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.action}</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
