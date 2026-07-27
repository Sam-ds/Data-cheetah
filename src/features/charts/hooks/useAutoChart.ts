import { useCallback, useEffect } from 'react'
import { useChartStore } from '@/features/charts/store/chartStore'
import { useQueryStore } from '@/features/sql/store/sqlStore'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import {
  buildChartOption,
  pickColumnsForChartType,
} from '@/features/charts/services/chartInferenceService'
import type { ChartType } from '@/types/chart'
import type { EChartsOption } from 'echarts'

export function useAutoChart() {
  const {
    inferred,
    selectedType,
    activeConfig,
    chartOption,
    setSelectedType,
    setActiveConfig,
    setChartOption,
  } = useChartStore()
  const result = useQueryStore((s) => s.result)
  const theme = usePreferencesStore((s) => s.theme)

  const rebuild = useCallback(
    (type: ChartType, configX?: string, configY?: string) => {
      if (!result) return
      const config = pickColumnsForChartType(result, type, {
        xColumn: configX,
        yColumn: configY,
      })
      setActiveConfig(config)
      const option = buildChartOption(result, type, config.xColumn, config.yColumn, theme)
      setChartOption(option as EChartsOption | null)
    },
    [result, theme, setActiveConfig, setChartOption],
  )

  const switchChartType = useCallback(
    (type: ChartType) => {
      if (!result) return
      setSelectedType(type)
      rebuild(type, activeConfig?.xColumn ?? inferred?.config.xColumn, activeConfig?.yColumn ?? inferred?.config.yColumn)
    },
    [result, activeConfig, inferred, setSelectedType, rebuild],
  )

  // Rebuild chart styles when theme toggles
  useEffect(() => {
    if (!result || selectedType === 'none') return
    const option = buildChartOption(
      result,
      selectedType,
      activeConfig?.xColumn ?? inferred?.config.xColumn,
      activeConfig?.yColumn ?? inferred?.config.yColumn,
      theme,
    )
    setChartOption(option as EChartsOption | null)
  }, [theme, result, selectedType, activeConfig, inferred, setChartOption])

  return {
    inferred,
    selectedType,
    chartOption,
    hasData: !!result && result.rows.length > 0,
    xColumn: activeConfig?.xColumn,
    yColumn: activeConfig?.yColumn,
    switchChartType,
  }
}
