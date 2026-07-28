import { Braces, Minimize2, GitCompare, FileDiff, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TOOL_LABELS, useToolsStore, type ToolId } from '../store/toolsStore'
import { JsonFormatterTool } from '../json-formatter/JsonFormatterTool'
import { JsonMinifierTool } from '../json-minifier/JsonMinifierTool'
import { JsonCompareTool } from '../json-compare/JsonCompareTool'
import { TextCompareTool } from '../text-compare/TextCompareTool'
import { SyntheticDataTool } from '../synthetic-data/SyntheticDataTool'

const TABS: { id: ToolId; icon: typeof Braces; blurb: string }[] = [
  { id: 'json-format', icon: Braces, blurb: 'Pretty-print' },
  { id: 'json-minify', icon: Minimize2, blurb: 'Compact' },
  { id: 'json-compare', icon: GitCompare, blurb: 'Diff JSON' },
  { id: 'text-compare', icon: FileDiff, blurb: 'Diff text' },
  { id: 'synthetic-data', icon: Wand2, blurb: 'Generate' },
]

/** In-layout tools page (no full-screen overlay). */
export function ToolsWorkspace() {
  const { activeToolId, setActiveToolId } = useToolsStore()

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="shrink-0 border-b bg-gradient-to-r from-muted/40 via-background to-muted/20 px-3 py-2.5">
        <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
          <div>
            <p className="text-sm font-semibold tracking-tight">Tools</p>
            <p className="text-[11px] text-muted-foreground">
              Local utilities — nothing leaves this browser
            </p>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {TABS.map(({ id, icon: Icon, blurb }) => {
            const active = activeToolId === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveToolId(id)}
                className={cn(
                  'group inline-flex shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all',
                  active
                    ? 'border-[#f2a01f]/45 bg-[#f2a01f]/12 shadow-sm'
                    : 'border-transparent bg-background/60 text-muted-foreground hover:border-border hover:bg-accent/60 hover:text-accent-foreground',
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Icon
                    className={cn('h-3.5 w-3.5', active ? 'text-[#f2a01f]' : 'text-muted-foreground')}
                  />
                  {TOOL_LABELS[id]}
                </span>
                <span className="text-[10px] text-muted-foreground">{blurb}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{activeToolId === 'json-format' && <JsonFormatterTool />}
        {activeToolId === 'json-minify' && <JsonMinifierTool />}
        {activeToolId === 'json-compare' && <JsonCompareTool />}
        {activeToolId === 'text-compare' && <TextCompareTool />}
        {activeToolId === 'synthetic-data' && <SyntheticDataTool />}
      </div>
    </div>
  )
}
