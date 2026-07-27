import { lazy, Suspense } from 'react'
import { useAutoChart } from '@/features/charts/hooks/useAutoChart'
import { ChartTypeSelector } from './ChartTypeSelector'
import { LineChart, Loader2 } from 'lucide-react'

const ReactECharts = lazy(() => import('echarts-for-react'))

interface ChartPanelProps {
  embedded?: boolean
}

export function ChartPanel({ embedded = false }: ChartPanelProps) {
  const { inferred, selectedType, chartOption, hasData, xColumn, yColumn, switchChartType } =
    useAutoChart()

  return (
    <div className="flex h-full flex-col">
      <div
        className={
          embedded
            ? 'flex h-8 items-center justify-between gap-2 border-b px-3'
            : 'panel-header flex items-center justify-between gap-2'
        }
      >
        {!embedded ? (
          <span className="flex items-center gap-1.5">
            <LineChart className="h-3.5 w-3.5" />
            Charts
          </span>
        ) : (
          <div className="min-w-0 truncate text-xs text-muted-foreground">
            {inferred
              ? selectedType === inferred.suggestedType
                ? inferred.reason
                : `Manual: ${selectedType}`
              : 'Charts'}
            {xColumn && (
              <span className="ml-2 font-mono text-[11px]">
                {xColumn}
                {yColumn ? ` → ${yColumn}` : ''}
              </span>
            )}
          </div>
        )}
        {hasData && <ChartTypeSelector value={selectedType} onChange={switchChartType} />}
      </div>
      <div className="flex-1 overflow-hidden p-3">
        {!hasData ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-muted-foreground">
            <p>Run a query to generate charts</p>
            <p className="text-xs opacity-70">Tip: SELECT a category and a numeric column</p>
          </div>
        ) : selectedType === 'none' || !chartOption ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No chart available for this data — try another chart type
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <ReactECharts
              option={chartOption}
              style={{ height: '100%', width: '100%', minHeight: 280 }}
              opts={{ renderer: 'canvas' }}
              notMerge
              lazyUpdate
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
