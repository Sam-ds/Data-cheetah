import type { ChartType } from '@/types/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'pie', label: 'Pie' },
  { value: 'scatter', label: 'Scatter' },
  { value: 'histogram', label: 'Histogram' },
  { value: 'none', label: 'None' },
]

interface ChartTypeSelectorProps {
  value: ChartType
  onChange: (type: ChartType) => void
}

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ChartType)}>
      <SelectTrigger className="h-6 w-24 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CHART_TYPES.map((t) => (
          <SelectItem key={t.value} value={t.value} className="text-xs">
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
