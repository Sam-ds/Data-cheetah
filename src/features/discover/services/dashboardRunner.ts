import { duckdbClient } from '@/services/duckdbClient'
import { importFileEphemeral } from '@/features/files/services/fileImportService'
import { ensureDuckDB } from '@/hooks/useDuckDB'
import { buildChartOption } from '@/features/charts/services/chartInferenceService'
import type {
  DashboardChartDef,
  DashboardDynamicVisualizationDef,
  DashboardPack,
  DashboardRule,
  DashboardSampleFile,
} from '@/types/dashboardPack'
import { normalizeSamples } from '@/types/dashboardPack'
import type { ColumnMapping } from './columnMapper'
import type { QueryResult } from '@/types/query'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { MAX_DYNAMIC_ROWS } from './dynamicVisualizationProtocol'

export interface DashboardChartResult {
  title: string
  type: DashboardChartDef['type']
  sql: string
  result: QueryResult
  xColumn?: string
  yColumn?: string
  y2Column?: string
  seriesColumn?: string
  sourceColumn?: string
  targetColumn?: string
  mapId?: 'world' | 'usa-states'
  option: Record<string, unknown> | null
  error?: string
}

export interface DashboardDynamicResult {
  visualizationId: DashboardDynamicVisualizationDef['visualizationId']
  title: string
  columns: string[]
  rows: Record<string, unknown>[]
  settings?: DashboardDynamicVisualizationDef['settings']
  sql: string
  error?: string
}

/** Flat role→column mapping, or per-table map when pack has multiple tables. */
export type DashboardMapping = ColumnMapping | Record<string, ColumnMapping>

function qIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
}

function isPerTableMapping(m: DashboardMapping): m is Record<string, ColumnMapping> {
  const values = Object.values(m)
  if (!values.length) return false
  const first = values[0]
  return typeof first === 'object' && first !== null && !Array.isArray(first)
}

function resolveRole(
  mapping: DashboardMapping,
  role: string | undefined,
  tableId?: string,
): string | undefined {
  if (!role) return undefined
  if (isPerTableMapping(mapping)) {
    if (tableId && mapping[tableId]?.[role]) return mapping[tableId][role]
    for (const t of Object.values(mapping)) {
      if (t[role]) return t[role]
    }
    return undefined
  }
  return mapping[role]
}

function fileStem(name: string): string {
  return name.replace(/\.csv$/i, '').trim() || 'sample'
}

function sampleFileForTable(
  samples: DashboardSampleFile[],
  tableFile: string,
): DashboardSampleFile | undefined {
  const want = fileStem(tableFile).toLowerCase()
  return (
    samples.find((s) => fileStem(s.name).toLowerCase() === want) ??
    samples.find((s) => s.name.toLowerCase() === tableFile.toLowerCase()) ??
    samples[0]
  )
}

function resolveAxes(
  chart: DashboardChartDef,
  mapping: DashboardMapping,
  tableId?: string,
): { xCol?: string; yCol?: string; y2Col?: string } {
  const xRole = chart.x ?? chart.dimension
  const yRole = chart.y ?? chart.measure
  const y2Role = chart.y2
  return {
    xCol: resolveRole(mapping, xRole, tableId),
    yCol: resolveRole(mapping, yRole, tableId),
    y2Col: resolveRole(mapping, y2Role, tableId),
  }
}

function buildChartSql(
  tableName: string,
  chart: DashboardChartDef,
  mapping: DashboardMapping,
  tableId?: string,
): {
  sql: string
  xCol?: string
  yCol?: string
  y2Col?: string
  seriesCol?: string
  sourceCol?: string
  targetCol?: string
  mapId?: 'world' | 'usa-states'
} {
  const { xCol, yCol, y2Col } = resolveAxes(chart, mapping, tableId)
  const seriesCol = resolveRole(mapping, chart.series, tableId)
  const sourceCol = resolveRole(mapping, chart.source ?? chart.x, tableId)
  const targetCol = resolveRole(mapping, chart.target ?? chart.y2, tableId)
  const t = qIdent(tableName)
  const agg = chart.agg ?? 'sum'
  const fn = agg === 'avg' ? 'AVG' : 'SUM'

  if (chart.type === 'sankey') {
    if (!sourceCol || !targetCol) {
      throw new Error(`Chart "${chart.title}" needs source and target mappings`)
    }
    const measureCol = resolveRole(mapping, chart.measure ?? chart.y, tableId)
    const s = qIdent(sourceCol)
    const tg = qIdent(targetCol)
    if (!measureCol) {
      return {
        sql: `SELECT ${s} AS ${s}, ${tg} AS ${tg}, COUNT(*)::DOUBLE AS value FROM ${t} WHERE ${s} IS NOT NULL AND ${tg} IS NOT NULL GROUP BY 1, 2 LIMIT 500`,
        sourceCol,
        targetCol,
        yCol: 'value',
      }
    }
    const m = qIdent(measureCol)
    return {
      sql: `SELECT ${s} AS ${s}, ${tg} AS ${tg}, ${fn}(${m})::DOUBLE AS ${m} FROM ${t} WHERE ${s} IS NOT NULL AND ${tg} IS NOT NULL GROUP BY 1, 2 LIMIT 500`,
      sourceCol,
      targetCol,
      yCol: measureCol,
    }
  }

  if (!xCol) throw new Error(`Chart "${chart.title}" is missing dimension/x mapping`)
  const x = qIdent(xCol)

  if (chart.type === 'histogram') {
    return { sql: `SELECT ${x} AS ${x} FROM ${t} WHERE ${x} IS NOT NULL LIMIT 20000`, xCol }
  }

  if (chart.type === 'scatter') {
    if (!yCol) throw new Error(`Chart "${chart.title}" needs a measure/y column`)
    const y = qIdent(yCol)
    return {
      sql: `SELECT ${x} AS ${x}, ${y} AS ${y} FROM ${t} WHERE ${x} IS NOT NULL AND ${y} IS NOT NULL LIMIT 5000`,
      xCol,
      yCol,
    }
  }

  if (chart.type === 'map') {
    if (!yCol) throw new Error(`Chart "${chart.title}" needs a measure`)
    const y = qIdent(yCol)
    return {
      sql: `SELECT ${x} AS ${x}, ${fn}(${y})::DOUBLE AS ${y} FROM ${t} WHERE ${x} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 300`,
      xCol,
      yCol,
      mapId: chart.map ?? 'world',
    }
  }

  if (chart.type === 'stacked_bar' || chart.type === 'stacked_area') {
    if (!seriesCol || !yCol) {
      throw new Error(`Chart "${chart.title}" needs series and measure mappings`)
    }
    const s = qIdent(seriesCol)
    const y = qIdent(yCol)
    return {
      sql: `SELECT ${x} AS ${x}, ${s} AS ${s}, ${fn}(${y})::DOUBLE AS ${y} FROM ${t} WHERE ${x} IS NOT NULL AND ${s} IS NOT NULL GROUP BY 1, 2 LIMIT 2000`,
      xCol,
      yCol,
      seriesCol,
    }
  }

  if (chart.type === 'sunburst') {
    if (!yCol && agg !== 'count') {
      throw new Error(`Chart "${chart.title}" needs a measure`)
    }
    if (!yCol || agg === 'count') {
      return {
        sql: `SELECT ${x} AS ${x}, COUNT(*)::DOUBLE AS value FROM ${t} WHERE ${x} IS NOT NULL GROUP BY 1 LIMIT 500`,
        xCol,
        yCol: 'value',
      }
    }
    const y = qIdent(yCol)
    return {
      sql: `SELECT ${x} AS ${x}, ${fn}(${y})::DOUBLE AS ${y} FROM ${t} WHERE ${x} IS NOT NULL GROUP BY 1 LIMIT 500`,
      xCol,
      yCol,
    }
  }

  if (chart.type === 'heatmap') {
    if (!yCol) throw new Error(`Chart "${chart.title}" needs y (second dimension)`)
    const measureRole = chart.measure
    const measureCol = measureRole
      ? resolveRole(mapping, measureRole, tableId)
      : y2Col
    const y = qIdent(yCol)
    if (!measureCol || measureCol === yCol || measureCol === xCol) {
      return {
        sql: `SELECT ${x} AS ${x}, ${y} AS ${y}, COUNT(*)::DOUBLE AS value FROM ${t} WHERE ${x} IS NOT NULL AND ${y} IS NOT NULL GROUP BY 1, 2 LIMIT 2000`,
        xCol,
        yCol,
      }
    }
    const m = qIdent(measureCol)
    return {
      sql: `SELECT ${x} AS ${x}, ${y} AS ${y}, ${fn}(${m})::DOUBLE AS value FROM ${t} WHERE ${x} IS NOT NULL AND ${y} IS NOT NULL GROUP BY 1, 2 LIMIT 2000`,
      xCol,
      yCol,
    }
  }

  if (chart.type === 'pyramid') {
    if (!yCol || !y2Col) {
      throw new Error(`Chart "${chart.title}" needs y and y2 (e.g. male / female)`)
    }
    const y = qIdent(yCol)
    const y2 = qIdent(y2Col)
    return {
      sql: `SELECT ${x} AS ${x}, ${fn}(${y})::DOUBLE AS ${y}, ${fn}(${y2})::DOUBLE AS ${y2} FROM ${t} WHERE ${x} IS NOT NULL GROUP BY 1 ORDER BY 1 LIMIT 200`,
      xCol,
      yCol,
      y2Col,
    }
  }

  if (
    chart.type === 'line' ||
    chart.type === 'area' ||
    chart.type === 'bar' ||
    chart.type === 'pie' ||
    chart.type === 'funnel' ||
    chart.type === 'treemap' ||
    chart.type === 'radar'
  ) {
    if (!yCol && agg !== 'count') {
      throw new Error(`Chart "${chart.title}" needs a measure/y column`)
    }
    if (agg === 'count' || !yCol) {
      return {
        sql: `SELECT ${x} AS ${x}, COUNT(*)::DOUBLE AS value FROM ${t} WHERE ${x} IS NOT NULL GROUP BY 1 ORDER BY 1 LIMIT 200`,
        xCol,
        yCol: 'value',
      }
    }
    const y = qIdent(yCol)
    return {
      sql: `SELECT ${x} AS ${x}, ${fn}(${y})::DOUBLE AS ${y} FROM ${t} WHERE ${x} IS NOT NULL GROUP BY 1 ORDER BY 1 LIMIT 200`,
      xCol,
      yCol,
    }
  }

  throw new Error(`Unsupported chart type: ${chart.type}`)
}

async function registerSampleAsTable(
  sample: DashboardSampleFile,
  tableName: string,
): Promise<string> {
  const file = new File([sample.csv], `${tableName}.csv`, { type: 'text/csv' })
  const dataset = await importFileEphemeral(file, tableName)
  return dataset.tableName
}

function sanitizeTableId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 't'
}

async function ensureJoinedView(
  pack: DashboardPack,
  tableNames: Record<string, string>,
  mapping: DashboardMapping,
): Promise<string | null> {
  const joins = pack.rule.joins
  if (!joins?.length) return null

  let leftId = joins[0].left
  let leftTable = tableNames[leftId]
  if (!leftTable) throw new Error(`Join left table "${leftId}" not loaded`)

  let alias = 'j0'
  let fromSql = `${qIdent(leftTable)} AS ${alias}`

  for (let i = 0; i < joins.length; i++) {
    const j = joins[i]
    const rightTable = tableNames[j.right]
    if (!rightTable) throw new Error(`Join right table "${j.right}" not loaded`)
    const leftKey =
      resolveRole(mapping, j.on[0], j.left) ??
      (isPerTableMapping(mapping) ? undefined : mapping[j.on[0]]) ??
      j.on[0]
    const rightKey =
      resolveRole(mapping, j.on[1], j.right) ??
      (isPerTableMapping(mapping) ? undefined : mapping[j.on[1]]) ??
      j.on[1]
    const rightAlias = `j${i + 1}`
    fromSql += ` JOIN ${qIdent(rightTable)} AS ${rightAlias} ON ${alias}.${qIdent(leftKey)} = ${rightAlias}.${qIdent(rightKey)}`
    leftId = j.right
    leftTable = rightTable
    alias = rightAlias
  }

  const viewName = `discover_joined_${sanitizeTableId(pack.meta.id)}`
  await duckdbClient.executeSql(`CREATE OR REPLACE TEMP VIEW ${qIdent(viewName)} AS SELECT * FROM ${fromSql}`)
  return viewName
}

export async function runDashboard(
  pack: DashboardPack,
  files: File | Record<string, File>,
  mapping: DashboardMapping,
): Promise<{
  tableName: string
  charts: DashboardChartResult[]
  dynamic?: DashboardDynamicResult
}> {
  await ensureDuckDB()
  const theme = usePreferencesStore.getState().theme === 'dark' ? 'dark' : 'light'
  const samples = normalizeSamples(pack)

  const tableNames: Record<string, string> = {}

  if (pack.rule.tables?.length) {
    for (const t of pack.rule.tables) {
      const fileMap = typeof files === 'object' && !(files instanceof File) ? files : null
      const uploaded = fileMap?.[t.id] ?? fileMap?.[fileStem(t.file)]
      if (uploaded) {
        const ds = await importFileEphemeral(uploaded, sanitizeTableId(t.id))
        tableNames[t.id] = ds.tableName
      } else {
        const sample = sampleFileForTable(samples, t.file)
        if (!sample) throw new Error(`Missing sample for table "${t.id}"`)
        tableNames[t.id] = await registerSampleAsTable(sample, sanitizeTableId(t.id))
      }
    }
  } else {
    const single =
      files instanceof File
        ? files
        : Object.values(files)[0] ??
          (samples[0]
            ? new File([samples[0].csv], `${samples[0].name}.csv`, { type: 'text/csv' })
            : null)
    if (!single) throw new Error('No data file provided')
    const ds = await importFileEphemeral(single, `sample_${sanitizeTableId(pack.meta.id)}`)
    tableNames.sample = ds.tableName
  }

  const joinedView = await ensureJoinedView(pack, tableNames, mapping)
  const defaultTable =
    joinedView ?? tableNames[pack.rule.tables?.[0]?.id ?? 'sample'] ?? Object.values(tableNames)[0]

  let dynamic: DashboardDynamicResult | undefined
  if (pack.rule.renderer === 'dynamic' && pack.rule.dynamic) {
    const def = pack.rule.dynamic
    try {
      let tableName = defaultTable
      let tableId = pack.rule.tables?.[0]?.id ?? 'sample'
      if (def.table === 'joined') {
        if (!joinedView) throw new Error(`Visualization "${def.title}" needs joins`)
        tableName = joinedView
      } else if (def.table && tableNames[def.table]) {
        tableName = tableNames[def.table]
        tableId = def.table
      }

      const selected = def.columns.map((role) => {
        const column = resolveRole(mapping, role, tableId)
        if (!column) throw new Error(`Missing mapping for "${role}"`)
        return `${qIdent(column)} AS ${qIdent(role)}`
      })
      const limit = Math.min(MAX_DYNAMIC_ROWS, def.maxRows ?? 1000)
      const sql = `SELECT ${selected.join(', ')} FROM ${qIdent(tableName)} LIMIT ${limit}`
      const result = await duckdbClient.executeSql(sql, limit)
      dynamic = {
        visualizationId: def.visualizationId,
        title: def.title,
        columns: def.columns,
        rows: result.rows,
        settings: def.settings,
        sql,
      }
    } catch (err) {
      dynamic = {
        visualizationId: def.visualizationId,
        title: def.title,
        columns: def.columns,
        rows: [],
        settings: def.settings,
        sql: '',
        error: err instanceof Error ? err.message : 'Dynamic visualization failed',
      }
    }
  }

  const charts: DashboardChartResult[] = []
  for (const chart of pack.rule.charts) {
    try {
      let tableName = defaultTable
      let tableId = pack.rule.tables?.[0]?.id ?? 'sample'
      if (chart.table === 'joined') {
        if (!joinedView) throw new Error(`Chart "${chart.title}" needs joins`)
        tableName = joinedView
      } else if (chart.table && tableNames[chart.table]) {
        tableName = tableNames[chart.table]
        tableId = chart.table
      }

      const { sql, xCol, yCol, y2Col, seriesCol, sourceCol, targetCol, mapId } = buildChartSql(
        tableName,
        chart,
        mapping,
        tableId,
      )
      const result = await duckdbClient.executeSql(sql, 5000)
      let yColumn = yCol
      if (yCol === 'value' && result.columns.includes('value')) {
        yColumn = 'value'
      }
      const option = buildChartOption(result, chart.type, xCol, yColumn, theme, {
        y2Column: y2Col,
        seriesColumn: seriesCol,
        sourceColumn: sourceCol,
        targetColumn: targetCol,
        mapId,
      })
      charts.push({
        title: chart.title,
        type: chart.type,
        sql,
        result,
        xColumn: xCol,
        yColumn,
        y2Column: y2Col,
        seriesColumn: seriesCol,
        sourceColumn: sourceCol,
        targetColumn: targetCol,
        mapId,
        option,
      })
    } catch (err) {
      charts.push({
        title: chart.title,
        type: chart.type,
        sql: '',
        result: { columns: [], columnTypes: [], rows: [], durationMs: 0 },
        option: null,
        error: err instanceof Error ? err.message : 'Chart failed',
      })
    }
  }

  return { tableName: defaultTable, charts, dynamic }
}

export function parseCsvHeaders(csvText: string): string[] {
  const first = csvText.split(/\r?\n/).find((l) => l.trim()) ?? ''
  return first
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}

export function validateMappingForRule(rule: DashboardRule, mapping: DashboardMapping): string[] {
  const errors: string[] = []
  if (rule.renderer === 'dynamic' && rule.dynamic) {
    const tableId =
      rule.dynamic.table && rule.dynamic.table !== 'joined'
        ? rule.dynamic.table
        : rule.tables?.[0]?.id ?? 'sample'
    for (const role of rule.dynamic.columns) {
      if (!resolveRole(mapping, role, tableId)) {
        errors.push(`Missing mapping for "${role}" (dynamic visualization)`)
      }
    }
  }
  const tables = rule.tables
  for (const chart of rule.charts) {
    const tableId =
      chart.table && chart.table !== 'joined'
        ? chart.table
        : tables?.[0]?.id ?? 'sample'
    const xRole = chart.x ?? chart.dimension
    const yRole = chart.y ?? chart.measure
    if (xRole && !resolveRole(mapping, xRole, tableId)) {
      errors.push(`Missing mapping for "${xRole}" (chart: ${chart.title})`)
    }
    if (
      (chart.type === 'bar' ||
        chart.type === 'line' ||
        chart.type === 'area' ||
        chart.type === 'pie' ||
        chart.type === 'funnel' ||
        chart.type === 'treemap' ||
        chart.type === 'radar' ||
        chart.type === 'scatter' ||
        chart.type === 'heatmap' ||
        chart.type === 'pyramid') &&
      chart.agg !== 'count' &&
      yRole &&
      !resolveRole(mapping, yRole, tableId)
    ) {
      errors.push(`Missing mapping for "${yRole}" (chart: ${chart.title})`)
    }
    if (chart.type === 'pyramid' && chart.y2 && !resolveRole(mapping, chart.y2, tableId)) {
      errors.push(`Missing mapping for "${chart.y2}" (chart: ${chart.title})`)
    }
  }
  return errors
}
