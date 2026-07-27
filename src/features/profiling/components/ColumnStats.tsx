import type { ColumnProfile } from '@/types/profile'
import { TopValuesList } from './TopValuesList'

interface ColumnStatsProps {
  profile: ColumnProfile
}

export function ColumnStats({ profile }: ColumnStatsProps) {
  return (
    <div className="border-b px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-medium">{profile.columnName}</span>
        <span className="text-xs text-muted-foreground">{profile.dataType}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Stat label="Null %" value={`${profile.nullPct}%`} />
        <Stat label="Distinct" value={profile.distinctCount.toLocaleString()} />
        <Stat label="Min" value={formatVal(profile.minVal)} />
        <Stat label="Max" value={formatVal(profile.maxVal)} />
        {profile.avgVal != null && <Stat label="Avg" value={profile.avgVal.toFixed(2)} />}
        {profile.medianVal != null && <Stat label="Median" value={profile.medianVal.toFixed(2)} />}
      </div>
      {profile.topValues.length > 0 && <TopValuesList values={profile.topValues} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

function formatVal(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'number') return val.toLocaleString()
  return String(val).slice(0, 24)
}
