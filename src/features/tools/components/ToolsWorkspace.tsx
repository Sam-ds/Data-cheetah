import { Braces, Minimize2, GitCompare, FileDiff, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TOOL_LABELS, useToolsStore, type ToolId } from '../store/toolsStore'
import { JsonFormatterTool } from '../json-formatter/JsonFormatterTool'
import { JsonMinifierTool } from '../json-minifier/JsonMinifierTool'
import { JsonCompareTool } from '../json-compare/JsonCompareTool'
import { TextCompareTool } from '../text-compare/TextCompareTool'
import { SyntheticDataTool } from '../synthetic-data/SyntheticDataTool'
import { PageStage } from '@/features/workspace/components/PageStage'

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
    <PageStage
      enterKey="tools"
      scroll={false}
      showArt={false}
      contentClassName="flex h-full min-h-0 flex-col"
    >
      <div className="shrink-0 border-b border-border bg-background/70 px-3 py-2 backdrop-blur-sm">
        <nav className="flex gap-0.5 overflow-x-auto" aria-label="Tools">
          {TABS.map(({ id, icon: Icon }) => {
            const active = activeToolId === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveToolId(id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition',
                  active
                    ? 'border-[#f2a01f] text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', active && 'text-[#f2a01f]')} />
                {TOOL_LABELS[id]}
              </button>
            )
          })}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-background/40">
        <div key={activeToolId} className="tool-pane-enter h-full min-h-0">
          {activeToolId === 'json-format' && <JsonFormatterTool />}
          {activeToolId === 'json-minify' && <JsonMinifierTool />}
          {activeToolId === 'json-compare' && <JsonCompareTool />}
          {activeToolId === 'text-compare' && <TextCompareTool />}
          {activeToolId === 'synthetic-data' && <SyntheticDataTool />}
        </div>
      </div>
    </PageStage>
  )
}
