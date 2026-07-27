import { Braces, Minimize2, GitCompare, FileDiff, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TOOL_LABELS, useToolsStore, type ToolId } from '../store/toolsStore'
import { JsonFormatterTool } from '../json-formatter/JsonFormatterTool'
import { JsonMinifierTool } from '../json-minifier/JsonMinifierTool'
import { JsonCompareTool } from '../json-compare/JsonCompareTool'
import { TextCompareTool } from '../text-compare/TextCompareTool'
import { SyntheticDataTool } from '../synthetic-data/SyntheticDataTool'

const TABS: { id: ToolId; icon: typeof Braces }[] = [
  { id: 'json-format', icon: Braces },
  { id: 'json-minify', icon: Minimize2 },
  { id: 'json-compare', icon: GitCompare },
  { id: 'text-compare', icon: FileDiff },
  { id: 'synthetic-data', icon: Wand2 },
]

/** In-layout tools page (no full-screen overlay). */
export function ToolsWorkspace() {
  const { activeToolId, setActiveToolId } = useToolsStore()

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
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
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeToolId === 'json-format' && <JsonFormatterTool />}
        {activeToolId === 'json-minify' && <JsonMinifierTool />}
        {activeToolId === 'json-compare' && <JsonCompareTool />}
        {activeToolId === 'text-compare' && <TextCompareTool />}
        {activeToolId === 'synthetic-data' && <SyntheticDataTool />}
      </div>
    </div>
  )
}
