import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CustomQuestionBoxProps {
  disabled?: boolean
  busy?: boolean
  onAsk: (question: string) => void
}

export function CustomQuestionBox({ disabled, busy, onAsk }: CustomQuestionBoxProps) {
  const [text, setText] = useState('')

  const submit = () => {
    const q = text.trim()
    if (!q) return
    onAsk(q)
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Ask your own question
      </p>
      <textarea
        className="min-h-[72px] w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[#f2a01f]/40"
        placeholder='e.g. "How many rows per country?" or "Top 5 cities by average lat"'
        value={text}
        disabled={disabled || busy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <Button
        size="sm"
        className="w-full"
        disabled={disabled || busy || !text.trim()}
        onClick={submit}
      >
        <Send className="h-3.5 w-3.5" />
        {busy ? 'Running…' : 'Ask & run SQL'}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Uses loaded schema + sample rows. Runs a SELECT in DuckDB, then summarizes the result.
      </p>
    </div>
  )
}
