import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAsk } from '../hooks/useAsk'
import { TableScopePicker } from './TableScopePicker'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import type { AskQueryStep } from '../llm/types'
import { sanitizeLlmText } from '@/lib/sanitizeLlmText'

/** Recover step blocks from combined editor SQL when `steps` was dropped. */
function stepsFromCombinedSql(sql: string): Pick<AskQueryStep, 'goal' | 'sql'>[] {
  const text = sql.trim()
  if (!text) return []
  const re = /--\s*Step\s+(\d+)\s*:\s*([^\n]*)\n([\s\S]*?)(?=\n--\s*Step\s+\d+\s*:|$)/gi
  const found: Pick<AskQueryStep, 'goal' | 'sql'>[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const goal = (m[2] ?? '').trim() || `Step ${m[1]}`
    const body = (m[3] ?? '').trim().replace(/;+\s*$/g, '')
    if (body) found.push({ goal, sql: body })
  }
  return found
}

/** Question bar between SQL editor and Results — scoped to selected tables. */
export function SqlAskBar() {
  const ask = useAsk()
  const setActiveRightTab = useWorkspaceStore((s) => s.setActiveRightTab)
  const [text, setText] = useState('')
  const [showSql, setShowSql] = useState(true)
  const answering = ask.phase === 'answering'
  const busy =
    ask.phase === 'loadingModel' || ask.phase === 'generatingInsights' || ask.phase === 'answering'
  const scopedCount = ask.selectedFileIds.filter((id) => ask.files.some((f) => f.id === id)).length
  const canAsk = ask.modelReady && scopedCount > 0 && !busy
  const reply = ask.sqlAskReply

  const displaySteps = useMemo(() => {
    if (!reply) return []
    if (reply.steps && reply.steps.length > 0) return reply.steps
    return stepsFromCombinedSql(reply.sql)
  }, [reply])

  const submit = () => {
    const q = text.trim()
    if (!q || !canAsk) return
    setShowSql(true)
    void ask.runAskQuestion(q)
  }

  return (
    <div className="shrink-0 border-b bg-gradient-to-r from-muted/40 via-background to-muted/20 px-3 py-2">
      {ask.files.length > 0 && (
        <TableScopePicker
          compact
          className="mb-2"
          files={ask.files}
          selectedFileIds={ask.selectedFileIds}
          onToggle={ask.toggleFileId}
          onSelectAll={ask.selectAllTables}
          onSelectNone={ask.selectNoTables}
          disabled={busy}
        />
      )}

      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#f2a01f]" />
        <input
          type="text"
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-[#f2a01f]/40"
          placeholder={
            ask.files.length === 0
              ? 'Open a file, then ask a question…'
              : scopedCount === 0
                ? 'Select at least one table above…'
                : !ask.modelReady
                  ? 'Load a model in Insights, then ask here…'
                  : 'Ask a question over the selected tables'
          }
          value={text}
          disabled={busy || ask.files.length === 0}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
        {!ask.modelReady && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => setActiveRightTab('ask')}
          >
            Insights
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1.5"
          disabled={!canAsk || !text.trim()}
          onClick={submit}
        >
          {answering ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {answering ? 'Running…' : 'Ask'}
        </Button>
      </div>

      {answering && ask.loadProgressText && (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
          {ask.loadProgressText}
          {ask.elapsedLabel ? ` · ${ask.elapsedLabel}` : ''}
        </p>
      )}

      {reply && !answering && (
        <div
          className={`mt-1.5 space-y-1.5 rounded-md px-2.5 py-2 text-[11px] leading-relaxed ${
            reply.error
              ? 'border border-destructive/40 bg-destructive/5 text-destructive'
              : 'border border-border/50 bg-muted/30 text-foreground'
          }`}
        >
          {reply.error ? (
            <p>{sanitizeLlmText(reply.error)}</p>
          ) : (
            <p>
              <span className="font-medium text-muted-foreground">Answer · </span>
              {sanitizeLlmText(reply.answer) || 'See Results below.'}
            </p>
          )}

          {(reply.sql || displaySteps.length > 0) && (
            <div>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowSql((v) => !v)}
                aria-expanded={showSql}
              >
                {showSql ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {displaySteps.length > 1
                  ? `Agent SQL · ${displaySteps.length} steps (also in the editor)`
                  : 'Agent SQL (also in the editor above)'}
              </button>
              {showSql && (
                <div className="mt-1 max-h-56 space-y-2 overflow-y-auto pr-0.5">
                  {displaySteps.length > 0 ? (
                    displaySteps.map((step, i) => (
                      <div key={`ask-step-${i}`} className="rounded-md bg-background/90 p-2">
                        <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                          Step {i + 1}
                          {displaySteps.length > 1 ? ` of ${displaySteps.length}` : ''}:{' '}
                          {step.goal}
                          {'error' in step && step.error ? ` · ${step.error}` : ''}
                          {'rowCount' in step && typeof step.rowCount === 'number'
                            ? ` · ${step.rowCount.toLocaleString()} rows`
                            : ''}
                        </p>
                        <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-snug text-foreground">
                          {step.sql}
                        </pre>
                      </div>
                    ))
                  ) : (
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background/90 p-2 text-[11px] leading-snug text-foreground">
                      {reply.sql}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
