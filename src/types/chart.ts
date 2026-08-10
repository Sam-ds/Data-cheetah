export type ChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'scatter'
  | 'histogram'
  | 'heatmap'
  | 'funnel'
  | 'treemap'
  | 'radar'
  | 'pyramid'
  | 'stacked_bar'
  | 'stacked_area'
  | 'sankey'
  | 'sunburst'
  | 'map'
  | 'none'

export type ChartMapId = 'world' | 'usa-states'

export interface ChartConfig {
  type: ChartType
  xColumn?: string
  yColumn?: string
  /** Second measure (pyramid) or heatmap value column */
  y2Column?: string
  title?: string
}

export interface InferredChart {
  suggestedType: ChartType
  config: ChartConfig
  reason: string
}
