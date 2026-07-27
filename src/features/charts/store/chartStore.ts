import { create } from 'zustand'
import type { ChartType, ChartConfig, InferredChart } from '@/types/chart'
import type { EChartsOption } from 'echarts'

interface ChartState {
  inferred: InferredChart | null
  selectedType: ChartType
  activeConfig: ChartConfig | null
  chartOption: EChartsOption | null
  setInferred: (inferred: InferredChart) => void
  setSelectedType: (type: ChartType) => void
  setActiveConfig: (config: ChartConfig | null) => void
  setChartOption: (option: EChartsOption | null) => void
  reset: () => void
}

export const useChartStore = create<ChartState>((set) => ({
  inferred: null,
  selectedType: 'none',
  activeConfig: null,
  chartOption: null,
  setInferred: (inferred) =>
    set({
      inferred,
      selectedType: inferred.suggestedType,
      activeConfig: inferred.config,
    }),
  setSelectedType: (type) => set({ selectedType: type }),
  setActiveConfig: (config) => set({ activeConfig: config }),
  setChartOption: (option) => set({ chartOption: option }),
  reset: () =>
    set({ inferred: null, selectedType: 'none', activeConfig: null, chartOption: null }),
}))
