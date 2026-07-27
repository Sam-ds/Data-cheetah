import { useEffect } from 'react'
import { X, Braces, Minimize2, GitCompare, FileDiff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils/cn'
import { TOOL_LABELS, useToolsStore, type ToolId } from '../store/toolsStore'
import { JsonFormatterTool } from '../json-formatter/JsonFormatterTool'
import { JsonMinifierTool } from '../json-minifier/JsonMinifierTool'
import { JsonCompareTool } from '../json-compare/JsonCompareTool'
import { TextCompareTool } from '../text-compare/TextCompareTool'

const TABS: { id: ToolId; icon: typeof Braces }[] = [
  { id: 'json-format', icon: Braces },
  { id: 'json-minify', icon: Minimize2 },
  { id: 'json-compare', icon: GitCompare },
  { id: 'text-compare', icon: FileDiff },
]

export function ToolsOverlay() {
  const { open, activeToolId, setActiveToolId, close } = useToolsStore()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <span className="pr-2 text-sm font-semibold">Tools</span>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveToolId(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                activeToolId === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {TOOL_LABELS[id]}
            </button>
          ))}
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={close} title="Close (Esc)">
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeToolId === 'json-format' && <JsonFormatterTool />}
        {activeToolId === 'json-minify' && <JsonMinifierTool />}
        {activeToolId === 'json-compare' && <JsonCompareTool />}
        {activeToolId === 'text-compare' && <TextCompareTool />}
      </div>
    </div>
  )
}
