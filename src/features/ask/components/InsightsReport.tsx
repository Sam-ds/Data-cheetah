import { useState } from 'react'
import { ChevronDown, ChevronRight, Database, FileSearch } from 'lucide-react'
import type { InsightFinding, InsightReport } from '../llm/types'
import { cn } from '@/lib/utils/cn'
import { sanitizeLlmText } from '@/lib/sanitizeLlmText'

interface InsightsReportProps {
  report: InsightReport | null
}

function cellText(row: Record<string, unknown>, column: string): string {
  const value = row[column] ?? row[column.toLowerCase()] ?? row[column.toUpperCase()]
  if (value == null) return 'null'
  return String(value)
}

export function InsightsReportView({ report }: InsightsReportProps) {
  if (!report) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Generate insights to get a summarised briefing grounded in DuckDB queries. You can then
        expand each finding to validate the SQL and result rows.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#f2a01f]/35 bg-gradient-to-br from-[rgba(242,160,31,0.12)] via-background to-background p-4">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-[#f2a01f]" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Insights summary
          </p>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {sanitizeLlmText(report.summary)}
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Evidence · queries &amp; output
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Expand a finding to inspect the SQL and result preview used for the summary.
        </p>
        <div className="space-y-2">
          {report.findings.map((finding, index) => (
            <FindingEvidence key={finding.id} finding={finding} index={index + 1} />
          ))}
        </div>
      </section>
    </div>
  )
}

function FindingEvidence({ finding, index }: { finding: InsightFinding; index: number }) {
  const [open, setOpen] = useState(false)
  const columns =
    finding.columns.length > 0
      ? finding.columns
      : finding.previewRows[0]
        ? Object.keys(finding.previewRows[0])
        : []
  const empty = Boolean(finding.emptyResult) || finding.rowCount === 0 || columns.length === 0
  const hasError = Boolean(finding.error)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border',
        hasError ? 'border-destructive/40' : 'border-border/60',
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            <span className="text-muted-foreground">{index}.</span>{' '}
            {sanitizeLlmText(finding.title)}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
            {hasError
              ? sanitizeLlmText(finding.error)
              : sanitizeLlmText(finding.answer) ||
                (empty ? 'No rows returned' : `${finding.rowCount} rows`)}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {open ? 'Hide' : 'View query'}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t bg-background/80 px-3 py-3">
          {finding.answer && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Finding note
              </p>
              <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap">
                {sanitizeLlmText(finding.answer)}
              </p>
            </div>
          )}
          {finding.sql && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                SQL
              </p>
              <pre className="mt-1 max-h-36 overflow-auto rounded-md bg-muted/60 p-2 text-[11px] leading-snug text-foreground">
                {finding.sql}
              </pre>
            </div>
          )}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Output ({finding.rowCount.toLocaleString()} row
              {finding.rowCount === 1 ? '' : 's'})
            </p>
            {hasError ? (
              <p className="mt-1 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive">
                {finding.error}
              </p>
            ) : empty ? (
              <p className="mt-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-100">
                No rows returned for this query.
              </p>
            ) : (
              <div className="mt-1 max-h-44 overflow-auto rounded-md border border-border/50">
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
                    {finding.previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-border/40">
                        {columns.map((c) => (
                          <td
                            key={c}
                            className="max-w-[8rem] truncate px-1.5 py-1 text-muted-foreground"
                          >
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
      )}
    </div>
  )
}
