import type { AskQuestion } from '../llm/types'
import { cn } from '@/lib/utils/cn'
import { Loader2 } from 'lucide-react'

interface QuestionListProps {
  questions: AskQuestion[]
  activeQuestionId: string | null
  answering: boolean
  generating?: boolean
  onSelect: (id: string) => void
}

export function QuestionList({
  questions,
  activeQuestionId,
  answering,
  generating,
  onSelect,
}: QuestionListProps) {
  if (generating && questions.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#f2a01f]/40 px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f2a01f]" />
        Waiting for the model to finish — sample insights will appear here.
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Load a model, select files, then ask your own question or run Sample insights.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {questions.map((q) => {
        const active = q.id === activeQuestionId
        return (
          <li key={q.id}>
            <button
              type="button"
              disabled={answering || generating}
              onClick={() => onSelect(q.id)}
              className={cn(
                'w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
                active
                  ? 'border-[#f2a01f]/50 bg-[rgba(242,160,31,0.08)]'
                  : 'border-border/60 bg-background/60 hover:bg-muted/50',
                answering && !active && 'opacity-50',
              )}
            >
              <span className="flex items-start gap-2">
                {answering && active && (
                  <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-[#f2a01f]" />
                )}
                <span>
                  <span className="font-medium text-foreground">{q.question}</span>
                  {q.rationale && (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{q.rationale}</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
