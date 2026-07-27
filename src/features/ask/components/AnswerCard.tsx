import type { AskAnswer } from '../llm/types'

interface AnswerCardProps {
  answer: AskAnswer | null
}

function cellText(row: Record<string, unknown>, column: string): string {
  const value = row[column] ?? row[column.toLowerCase()] ?? row[column.toUpperCase()]
  if (value == null) return 'null'
  return String(value)
}

export function AnswerCard({ answer }: AnswerCardProps) {
  if (!answer) {
    return (
      <p className="text-xs text-muted-foreground">
        Ask your own question or click a suggestion — SQL runs in DuckDB, then you get a short answer plus result preview.
      </p>
    )
  }

  if (answer.error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        {answer.error}
      </div>
    )
  }

  const columns =
    answer.columns.length > 0
      ? answer.columns
      : answer.previewRows[0]
        ? Object.keys(answer.previewRows[0])
        : []

  const empty = Boolean(answer.emptyResult) || answer.rowCount === 0 || columns.length === 0

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/70 p-3 text-left">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Answer</p>
        <p
          className={`mt-1 text-sm leading-relaxed whitespace-pre-wrap ${
            empty ? 'text-amber-800 dark:text-amber-200' : 'text-foreground'
          }`}
        >
          {answer.answer}
        </p>
      </div>
      {answer.sql && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">SQL</p>
          <pre className="mt-1 max-h-28 overflow-auto rounded-md bg-muted/60 p-2 text-[11px] leading-snug text-foreground">
            {answer.sql}
          </pre>
        </div>
      )}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Preview ({answer.rowCount.toLocaleString()} row{answer.rowCount === 1 ? '' : 's'})
        </p>
        {empty ? (
          <p className="mt-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-100">
            No rows to show. Answers are never invented when the query is empty — check or edit the SQL.
          </p>
        ) : (
          <div className="mt-1 max-h-36 overflow-auto rounded-md border border-border/50">
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-1.5 py-1 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {answer.previewRows.map((row, i) => (
                  <tr key={i} className="border-t border-border/40">
                    {columns.map((c) => (
                      <td key={c} className="max-w-[8rem] truncate px-1.5 py-1 text-muted-foreground">
                        {cellText(row, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
