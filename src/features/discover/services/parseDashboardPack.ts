import type {
  DashboardChartDef,
  DashboardColumnRole,
  DashboardDynamicVisualizationDef,
  DashboardJoinDef,
  DashboardMeta,
  DashboardPack,
  DashboardRule,
  DashboardSampleFile,
  DashboardTableDef,
} from '@/types/dashboardPack'
import { DYNAMIC_VISUALIZATION_IDS } from '@/types/dashboardPack'
import type { ChartType } from '@/types/chart'

const CHART_TYPES: ChartType[] = [
  'bar',
  'line',
  'area',
  'pie',
  'scatter',
  'histogram',
  'heatmap',
  'funnel',
  'treemap',
  'radar',
  'pyramid',
  'stacked_bar',
  'stacked_area',
  'sankey',
  'sunburst',
  'map',
]

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function parseMeta(raw: unknown): DashboardMeta {
  if (!isObject(raw)) throw new Error('meta.json must be an object')
  const id = String(raw.id ?? '').trim()
  const name = String(raw.name ?? '').trim()
  const category = String(raw.category ?? 'operations').trim().toLowerCase()
  const description = String(raw.description ?? '').trim()
  const version = String(raw.version ?? '1.0.0').trim()
  if (!id || !name) throw new Error('meta.json requires id and name')
  const authorRaw =
    raw.author != null
      ? String(raw.author).trim()
      : raw.publisher != null
        ? String(raw.publisher).trim()
        : undefined
  const publisherRaw =
    raw.publisher != null
      ? String(raw.publisher).trim()
      : authorRaw
  return {
    id,
    name,
    category,
    description: description || name,
    version,
    author: authorRaw || undefined,
    publisher: publisherRaw || undefined,
    insights: Array.isArray(raw.insights)
      ? raw.insights.map((i) => String(i).trim()).filter(Boolean)
      : undefined,
  }
}

function parseColumn(raw: unknown): DashboardColumnRole {
  if (!isObject(raw)) throw new Error('Invalid requiredColumns entry')
  const role = String(raw.role ?? '').trim()
  if (!role) throw new Error('Column role is required')
  const aliases = Array.isArray(raw.aliases)
    ? raw.aliases.map((a) => String(a).trim()).filter(Boolean)
    : [role]
  const typeRaw = String(raw.type ?? 'string').toLowerCase()
  const type =
    typeRaw === 'number' || typeRaw === 'integer' || typeRaw === 'date' || typeRaw === 'string'
      ? typeRaw
      : 'string'
  const kind =
    raw.kind === 'dimension' || raw.kind === 'measure' ? raw.kind : undefined
  return { role, aliases: aliases.length ? aliases : [role], type, kind }
}

function parseChart(raw: unknown): DashboardChartDef {
  if (!isObject(raw)) throw new Error('Invalid charts entry')
  const type = String(raw.type ?? 'bar') as ChartType
  if (!CHART_TYPES.includes(type) || type === 'none') {
    throw new Error(`Unsupported chart type: ${String(raw.type)}`)
  }
  const title = String(raw.title ?? type).trim() || type
  const x = raw.x != null ? String(raw.x) : undefined
  const y = raw.y != null ? String(raw.y) : undefined
  const y2 = raw.y2 != null ? String(raw.y2) : undefined
  const series = raw.series != null ? String(raw.series) : undefined
  const source = raw.source != null ? String(raw.source) : undefined
  const target = raw.target != null ? String(raw.target) : undefined
  const dimension = raw.dimension != null ? String(raw.dimension) : undefined
  const measure = raw.measure != null ? String(raw.measure) : undefined
  const table = raw.table != null ? String(raw.table) : undefined
  const mapRaw = raw.map != null ? String(raw.map) : undefined
  const map = mapRaw === 'world' || mapRaw === 'usa-states' ? mapRaw : undefined
  const aggRaw = raw.agg != null ? String(raw.agg).toLowerCase() : undefined
  const agg =
    aggRaw === 'sum' || aggRaw === 'count' || aggRaw === 'avg' ? aggRaw : undefined
  return {
    type: type as Exclude<ChartType, 'none'>,
    title,
    x,
    y,
    y2,
    series,
    source,
    target,
    dimension,
    measure,
    agg,
    table,
    map,
  }
}

function parseTable(raw: unknown): DashboardTableDef {
  if (!isObject(raw)) throw new Error('Invalid tables entry')
  const id = String(raw.id ?? '').trim()
  const file = String(raw.file ?? id).trim()
  if (!id) throw new Error('tables[].id is required')
  const cols = Array.isArray(raw.requiredColumns) ? raw.requiredColumns.map(parseColumn) : []
  if (!cols.length) throw new Error(`Table "${id}" needs requiredColumns`)
  return { id, file, requiredColumns: cols }
}

function parseJoin(raw: unknown): DashboardJoinDef {
  if (!isObject(raw)) throw new Error('Invalid joins entry')
  const left = String(raw.left ?? '').trim()
  const right = String(raw.right ?? '').trim()
  const on = Array.isArray(raw.on) ? raw.on.map((x) => String(x)) : []
  if (!left || !right || on.length < 2) {
    throw new Error('joins need left, right, and on: [leftKey, rightKey]')
  }
  return { left, right, on: [on[0], on[1]] }
}

function parseDynamicVisualization(raw: unknown): DashboardDynamicVisualizationDef {
  if (!isObject(raw)) throw new Error('rule.dynamic must be an object')
  const visualizationId = String(raw.visualizationId ?? '').trim()
  if (!DYNAMIC_VISUALIZATION_IDS.includes(visualizationId as never)) {
    throw new Error(`Unknown dynamic visualization: ${visualizationId || '(missing)'}`)
  }
  const title = String(raw.title ?? 'Interactive visualization').trim()
  const columns = Array.isArray(raw.columns)
    ? [...new Set(raw.columns.map((value) => String(value).trim()).filter(Boolean))]
    : []
  if (!columns.length) throw new Error('rule.dynamic.columns needs at least one role')
  const rawMaxRows = Number(raw.maxRows ?? 1000)
  const maxRows = Number.isFinite(rawMaxRows)
    ? Math.max(1, Math.min(2000, Math.floor(rawMaxRows)))
    : 1000
  const settings: Record<string, string | number | boolean> = {}
  if (isObject(raw.settings)) {
    for (const [key, value] of Object.entries(raw.settings)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        settings[key] = value
      }
    }
  }
  return {
    visualizationId: visualizationId as DashboardDynamicVisualizationDef['visualizationId'],
    entry: visualizationId === 'pack' ? 'visualization.js' : undefined,
    title: title || 'Interactive visualization',
    table: raw.table != null ? String(raw.table).trim() || undefined : undefined,
    columns,
    maxRows,
    settings: Object.keys(settings).length ? settings : undefined,
  }
}

export function parseDashboardRule(raw: unknown): DashboardRule {
  if (!isObject(raw)) throw new Error('rule.json must be an object')
  const charts = Array.isArray(raw.charts) ? raw.charts.map(parseChart) : []
  const renderer = raw.renderer === 'dynamic' || isObject(raw.dynamic) ? 'dynamic' : 'charts'
  const dynamic = renderer === 'dynamic' ? parseDynamicVisualization(raw.dynamic) : undefined
  if (renderer === 'charts' && charts.length === 0) {
    throw new Error('rule.json needs at least one chart')
  }

  const tables = Array.isArray(raw.tables) ? raw.tables.map(parseTable) : undefined
  const joins = Array.isArray(raw.joins) ? raw.joins.map(parseJoin) : undefined
  const cols = Array.isArray(raw.requiredColumns) ? raw.requiredColumns.map(parseColumn) : undefined

  if ((!tables || tables.length === 0) && (!cols || cols.length === 0)) {
    throw new Error('rule.json needs requiredColumns or tables')
  }

  return {
    renderer,
    requiredColumns: cols?.length ? cols : undefined,
    tables: tables?.length ? tables : undefined,
    joins: joins?.length ? joins : undefined,
    charts,
    dynamic,
  }
}

function parseSamples(parts: {
  sampleCsv?: string
  samples?: DashboardSampleFile[]
}): DashboardSampleFile[] | undefined {
  if (parts.samples?.length) {
    return parts.samples
      .map((s) => ({ name: s.name.trim() || 'sample', csv: s.csv }))
      .filter((s) => s.csv.trim())
  }
  if (parts.sampleCsv?.trim()) {
    return [{ name: 'sample', csv: parts.sampleCsv }]
  }
  return undefined
}

export function parseDashboardPack(parts: {
  meta: unknown
  rule: unknown
  sampleCsv?: string
  samples?: DashboardSampleFile[]
  visualizationJs?: string
  source?: 'bundled' | 'installed'
}): DashboardPack {
  const samples = parseSamples(parts)
  const source = parts.source ?? 'installed'
  const rule = parseDashboardRule(parts.rule)
  if (rule.renderer === 'dynamic' && rule.dynamic?.visualizationId === 'pack' && !parts.visualizationJs?.trim()) {
    throw new Error('Dynamic Three.js packs must include visualization.js')
  }
  if (
    rule.renderer === 'dynamic' &&
    source !== 'bundled' &&
    rule.dynamic?.visualizationId !== 'pack'
  ) {
    throw new Error(
      'Installed dynamic packs must use visualizationId "pack" with visualization.js',
    )
  }
  return {
    meta: parseMeta(parts.meta),
    rule,
    sampleCsv: samples?.[0]?.csv,
    samples,
    visualizationJs: parts.visualizationJs?.trim() || undefined,
    source,
  }
}
