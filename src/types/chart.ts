export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'none'

export interface ChartConfig {
  type: ChartType
  xColumn?: string
  yColumn?: string
  title?: string
}

export interface InferredChart {
  suggestedType: ChartType
  config: ChartConfig
  reason: string
}
