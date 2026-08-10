import type { ChartType } from '@/types/chart'

export type DashboardColumnType = 'string' | 'number' | 'date' | 'integer'

export interface DashboardColumnRole {
  /** Logical role used by charts, e.g. date, amount, category */
  role: string
  aliases: string[]
  type: DashboardColumnType
  /** dimension | measure — optional hint for UI */
  kind?: 'dimension' | 'measure'
}

export interface DashboardChartDef {
  type: Exclude<ChartType, 'none'>
  title: string
  /** Role name for x / category / histogram value / age band / map region */
  x?: string
  /** Role name for y / measure / male count */
  y?: string
  /** Second measure for pyramid (e.g. female) or heatmap value when not using measure */
  y2?: string
  /** Stack series dimension (stacked_bar / stacked_area) */
  series?: string
  /** Sankey source role */
  source?: string
  /** Sankey target role */
  target?: string
  /** Alias for pie/funnel/treemap: dimension role */
  dimension?: string
  /** Alias for pie/funnel/treemap/heatmap/map value */
  measure?: string
  agg?: 'sum' | 'count' | 'avg'
  /** Table id from rule.tables, or "joined" */
  table?: string
  /** Choropleth map registry id */
  map?: 'world' | 'usa-states'
}

export interface DashboardMeta {
  id: string
  name: string
  category: string
  description: string
  version: string
  /** Template publisher / author */
  author?: string
  /** Alias for author when packs use "publisher" */
  publisher?: string
  /** What you can visualize with this template (chart takeaways) */
  insights?: string[]
}

export interface DashboardTableDef {
  id: string
  /** Sample file stem or name, e.g. households / households.csv */
  file: string
  requiredColumns: DashboardColumnRole[]
}

export interface DashboardJoinDef {
  left: string
  right: string
  /** Role names (resolved via per-table mapping) or literal column names */
  on: [string, string]
}

export const DYNAMIC_VISUALIZATION_IDS = ['pack'] as const
export type DynamicVisualizationId = (typeof DYNAMIC_VISUALIZATION_IDS)[number]

export type DynamicVisualizationSetting = string | number | boolean

export interface DashboardDynamicVisualizationDef {
  /** Bundled renderer id, or "pack" for a sandboxed visualization.js entry. */
  visualizationId: DynamicVisualizationId
  /** Executable entry for visualizationId "pack". */
  entry?: 'visualization.js'
  title: string
  /** Table id from rule.tables, or "joined". */
  table?: string
  /** Logical roles to expose to the renderer. Results use these role names as keys. */
  columns: string[]
  /** Hard-capped by the runner to protect the iframe message boundary. */
  maxRows?: number
  settings?: Record<string, DynamicVisualizationSetting>
}

export interface DashboardRule {
  /** Existing packs default to charts. */
  renderer?: 'charts' | 'dynamic'
  /** Legacy single-table columns (when tables is omitted) */
  requiredColumns?: DashboardColumnRole[]
  tables?: DashboardTableDef[]
  joins?: DashboardJoinDef[]
  charts: DashboardChartDef[]
  dynamic?: DashboardDynamicVisualizationDef
}

export interface DashboardSampleFile {
  /** Table / file id used in rule.tables[].file */
  name: string
  csv: string
}

/** Full Open Dashboard pack (meta + rule + sample data). */
export interface DashboardPack {
  meta: DashboardMeta
  rule: DashboardRule
  /** Legacy single sample — prefer samples[] */
  sampleCsv?: string
  samples?: DashboardSampleFile[]
  /** Sandboxed Three.js renderer source loaded from visualization.js. */
  visualizationJs?: string
  /** bundled | installed */
  source: 'bundled' | 'installed'
}

export const DASHBOARD_CATEGORIES = [
  'all',
  'finance',
  'sales',
  'ecommerce',
  'marketing',
  'operations',
  'product',
  'healthcare',
  'education',
  'demographics',
] as const

export type DashboardCategory = (typeof DASHBOARD_CATEGORIES)[number]

/** Flatten required columns for UI / mapping (legacy or first table / all tables). */
export function packRequiredColumns(rule: DashboardRule): DashboardColumnRole[] {
  if (rule.tables?.length) {
    return rule.tables.flatMap((t) =>
      t.requiredColumns.map((c) => ({
        ...c,
        role: rule.tables!.length > 1 ? `${t.id}.${c.role}` : c.role,
      })),
    )
  }
  return rule.requiredColumns ?? []
}

export function normalizeSamples(pack: Pick<DashboardPack, 'sampleCsv' | 'samples'>): DashboardSampleFile[] {
  if (pack.samples?.length) return pack.samples
  if (pack.sampleCsv?.trim()) return [{ name: 'sample', csv: pack.sampleCsv }]
  return []
}
