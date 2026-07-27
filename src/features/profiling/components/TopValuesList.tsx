import type { TopValue } from '@/types/profile'

interface TopValuesListProps {
  values: TopValue[]
}

export function TopValuesList({ values }: TopValuesListProps) {
  const maxFreq = Math.max(...values.map((v) => v.frequency))

  return (
    <div className="mt-2 space-y-1">
      <div className="text-xs text-muted-foreground">Top values</div>
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-24 truncate font-mono">{String(v.value)}</span>
          <div className="h-1.5 flex-1 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${(v.frequency / maxFreq) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-muted-foreground">{v.frequency}</span>
        </div>
      ))}
    </div>
  )
}
