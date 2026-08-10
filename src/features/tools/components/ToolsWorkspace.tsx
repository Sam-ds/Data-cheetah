import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Braces, Minimize2, GitCompare, FileDiff, Wand2, Sparkles, Search, X } from 'lucide-react'
import { TOOL_LABELS, useToolsStore, type ToolId } from '../store/toolsStore'
import { JsonFormatterTool } from '../json-formatter/JsonFormatterTool'
import { JsonMinifierTool } from '../json-minifier/JsonMinifierTool'
import { JsonCompareTool } from '../json-compare/JsonCompareTool'
import { TextCompareTool } from '../text-compare/TextCompareTool'
import { SyntheticDataTool } from '../synthetic-data/SyntheticDataTool'
import { PageStage } from '@/features/workspace/components/PageStage'

const TOOLS: { id: ToolId; icon: typeof Braces; description: string }[] = [
  { id: 'json-format', icon: Braces, description: 'Pretty-print and validate JSON locally.' },
  { id: 'json-minify', icon: Minimize2, description: 'Compact JSON into a clean single line.' },
  { id: 'json-compare', icon: GitCompare, description: 'Normalize and compare two JSON documents.' },
  { id: 'text-compare', icon: FileDiff, description: 'Review line-by-line changes in plain text.' },
  { id: 'synthetic-data', icon: Wand2, description: 'Create realistic datasets with rules and faker.' },
]

/** In-layout tools page (no full-screen overlay). */
export function ToolsWorkspace() {
  const { open, activeToolId, openTool, close } = useToolsStore()
  const [query, setQuery] = useState('')
  const activeTool = TOOLS.find((tool) => tool.id === activeToolId) ?? TOOLS[0]
  const ActiveIcon = activeTool.icon
  const filteredTools = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return TOOLS
    return TOOLS.filter((tool) =>
      `${TOOL_LABELS[tool.id]} ${tool.description}`.toLocaleLowerCase().includes(needle),
    )
  }, [query])

  return (
    <PageStage
      enterKey={open ? activeToolId : 'tools'}
      scroll={false}
      showArt={false}
      contentClassName="flex h-full min-h-0 flex-col"
    >
      {!open ? (
        <div className="tools-selector h-full overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex items-start gap-3">
              <span className="page-heading-icon"><Sparkles className="h-4 w-4" /></span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Tools</h1>
                <p className="tools-selector-intro mt-1 text-xs">
                  Local utilities to format, compare, and generate data without leaving your browser.
                </p>
              </div>
            </div>
            <div className="tools-search-wrap">
                  <Search className="tools-search-icon" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="tools-search-input"
                    placeholder="Search tools by name or purpose…"
                    aria-label="Search tools"
                  />
                  <span className="tools-search-count" aria-live="polite">
                    {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'}
                  </span>
                  {query && (
                    <button
                      type="button"
                      className="tools-search-clear"
                      onClick={() => setQuery('')}
                      aria-label="Clear tool search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <nav className="tools-selector-grid page-stagger mt-8" aria-label="Tools">
                  {filteredTools.map(({ id, icon: Icon, description }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => openTool(id)}
                      className="tools-selector-card group"
                    >
                      <span className="tools-selector-icon"><Icon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-sm font-semibold text-foreground">{TOOL_LABELS[id]}</span>
                        <span className="tools-selector-description mt-1 block text-xs leading-relaxed">{description}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-[var(--brand)]" />
                    </button>
                  ))}
                </nav>
                {filteredTools.length === 0 && (
                  <div className="tools-search-empty">
                    <Search className="h-5 w-5" />
                    <p className="mt-3 text-sm font-semibold text-foreground">No tools found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try another name or describe what you want to do.
                    </p>
                    <button type="button" className="brand-link mt-3 text-xs font-medium" onClick={() => setQuery('')}>
                      Clear search
                    </button>
                  </div>
            )}
          </div>
        </div>
      ) : (
        <div className="focused-tool-view flex h-full min-h-0 flex-col">
          <div className="focused-tool-bar shrink-0">
            <button type="button" onClick={close} className="focused-tool-back">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to tools
            </button>
            <span className="focused-tool-divider" aria-hidden />
            <span className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
              <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
              <span className="truncate">{TOOL_LABELS[activeToolId]}</span>
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <div key={activeToolId} className="focused-tool-enter mx-auto h-full min-h-0 w-full max-w-6xl">
              {activeToolId === 'json-format' && <JsonFormatterTool />}
              {activeToolId === 'json-minify' && <JsonMinifierTool />}
              {activeToolId === 'json-compare' && <JsonCompareTool />}
              {activeToolId === 'text-compare' && <TextCompareTool />}
              {activeToolId === 'synthetic-data' && <SyntheticDataTool />}
            </div>
          </div>
        </div>
      )}
    </PageStage>
  )
}
