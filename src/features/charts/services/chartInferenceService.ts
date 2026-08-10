import type { ChartType, ChartConfig, InferredChart } from '@/types/chart'
import type { QueryResult } from '@/types/query'

/** Match DuckDB SQL types and Arrow type strings from duckdb-wasm. */
function isTemporal(type: string): boolean {
  const t = type.toUpperCase()
  return (
    t.includes('DATE') ||
    t.includes('TIME') ||
    t.includes('TIMESTAMP') ||
    t.includes('DATETIME')
  )
}

function isNumeric(type: string): boolean {
  const t = type.toUpperCase()
  return (
    t.includes('INT') ||
    t.includes('DOUBLE') ||
    t.includes('FLOAT') ||
    t.includes('DECIMAL') ||
    t.includes('NUMERIC') ||
    t.includes('REAL') ||
    t.includes('HUGEINT') ||
    t === 'NUMBER'
  )
}

function isString(type: string): boolean {
  const t = type.toUpperCase()
  return (
    t.includes('VARCHAR') ||
    t.includes('STRING') ||
    t.includes('UTF8') ||
    t.includes('CHAR') ||
    t.includes('TEXT') ||
    t.includes('BLOB') ||
    t.includes('LARGE_STRING')
  )
}

function looksNumeric(value: unknown): boolean {
  if (typeof value === 'number' && Number.isFinite(value)) return true
  if (typeof value === 'bigint') return true
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return true
  return false
}

function looksTemporal(value: unknown): boolean {
  if (value instanceof Date) return true
  if (typeof value !== 'string') return false
  // ISO-ish dates: 2024-01-15 or 2024-01-15T10:00:00
  return /^\d{4}-\d{2}-\d{2}/.test(value.trim())
}

function classifyColumns(result: QueryResult): {
  temporalCols: string[]
  numericCols: string[]
  stringCols: string[]
} {
  const { columns, columnTypes, rows } = result
  const sample = rows.slice(0, Math.min(50, rows.length))

  const temporalCols: string[] = []
  const numericCols: string[] = []
  const stringCols: string[] = []

  columns.forEach((col, i) => {
    const type = columnTypes[i] ?? ''
    if (isTemporal(type)) {
      temporalCols.push(col)
      return
    }
    if (isNumeric(type)) {
      numericCols.push(col)
      return
    }
    if (isString(type)) {
      stringCols.push(col)
      return
    }

    // Fallback: infer from sample values when Arrow type string is unknown
    const values = sample.map((r) => r[col]).filter((v) => v != null)
    if (values.length === 0) {
      stringCols.push(col)
      return
    }
    const numericHits = values.filter(looksNumeric).length
    const temporalHits = values.filter(looksTemporal).length
    if (temporalHits / values.length >= 0.8) temporalCols.push(col)
    else if (numericHits / values.length >= 0.8) numericCols.push(col)
    else stringCols.push(col)
  })

  return { temporalCols, numericCols, stringCols }
}

function getDistinctCount(rows: Record<string, unknown>[], column: string): number {
  return new Set(rows.map((r) => String(r[column]))).size
}

/** Aggregate category → sum(y) or count when y is missing / non-numeric. */
function aggregateByCategory(
  rows: Record<string, unknown>[],
  xColumn: string,
  yColumn?: string,
): { labels: string[]; values: number[] } {
  const map = new Map<string, number>()
  for (const row of rows) {
    const key = String(row[xColumn] ?? '')
    const add = yColumn != null ? Number(row[yColumn]) || 0 : 1
    map.set(key, (map.get(key) ?? 0) + add)
  }
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)
  return {
    labels: entries.map(([k]) => k),
    values: entries.map(([, v]) => v),
  }
}

export function pickColumnsForChartType(
  result: QueryResult,
  chartType: ChartType,
  preferred?: { xColumn?: string; yColumn?: string },
): ChartConfig {
  const { temporalCols, numericCols, stringCols } = classifyColumns(result)
  const { columns } = result

  switch (chartType) {
    case 'line':
    case 'area':
      return {
        type: chartType,
        xColumn: preferred?.xColumn && temporalCols.includes(preferred.xColumn)
          ? preferred.xColumn
          : temporalCols[0] ?? stringCols[0] ?? columns[0],
        yColumn: preferred?.yColumn && numericCols.includes(preferred.yColumn)
          ? preferred.yColumn
          : numericCols[0] ?? columns[1],
      }
    case 'bar':
    case 'pie':
    case 'funnel':
    case 'treemap':
    case 'radar':
      return {
        type: chartType,
        xColumn: preferred?.xColumn && (stringCols.includes(preferred.xColumn) || temporalCols.includes(preferred.xColumn))
          ? preferred.xColumn
          : stringCols[0] ?? temporalCols[0] ?? columns[0],
        yColumn: preferred?.yColumn && numericCols.includes(preferred.yColumn)
          ? preferred.yColumn
          : numericCols[0],
      }
    case 'scatter':
      return {
        type: 'scatter',
        xColumn: preferred?.xColumn && numericCols.includes(preferred.xColumn)
          ? preferred.xColumn
          : numericCols[0] ?? columns[0],
        yColumn: preferred?.yColumn && numericCols.includes(preferred.yColumn)
          ? preferred.yColumn
          : numericCols[1] ?? numericCols[0] ?? columns[1],
      }
    case 'heatmap':
      return {
        type: 'heatmap',
        xColumn: preferred?.xColumn ?? stringCols[0] ?? columns[0],
        yColumn: preferred?.yColumn ?? stringCols[1] ?? columns[1],
        y2Column: numericCols[0],
      }
    case 'pyramid':
      return {
        type: 'pyramid',
        xColumn: preferred?.xColumn ?? stringCols[0] ?? columns[0],
        yColumn: preferred?.yColumn ?? numericCols[0],
        y2Column: numericCols[1] ?? numericCols[0],
      }
    case 'histogram':
      return {
        type: 'histogram',
        xColumn: preferred?.xColumn && numericCols.includes(preferred.xColumn)
          ? preferred.xColumn
          : numericCols[0] ?? columns[0],
      }
    default:
      return { type: 'none' }
  }
}

export function inferChart(result: QueryResult): InferredChart {
  const { columns, rows } = result

  if (columns.length === 0 || rows.length === 0) {
    return {
      suggestedType: 'none',
      config: { type: 'none' },
      reason: 'No data to chart',
    }
  }

  const { temporalCols, numericCols, stringCols } = classifyColumns(result)

  if (temporalCols.length >= 1 && numericCols.length >= 1) {
    const config = pickColumnsForChartType(result, 'line')
    return {
      suggestedType: 'line',
      config: { ...config, title: `${config.yColumn} over time` },
      reason: 'Date + numeric → line chart',
    }
  }

  if (stringCols.length >= 1 && numericCols.length >= 1) {
    const catCol = stringCols[0]
    const distinct = getDistinctCount(rows, catCol)
    if (distinct <= 8) {
      const config = pickColumnsForChartType(result, 'pie')
      return {
        suggestedType: 'pie',
        config: { ...config, title: `${config.yColumn} by ${config.xColumn}` },
        reason: 'Few categories → pie chart',
      }
    }
    const config = pickColumnsForChartType(result, 'bar')
    return {
      suggestedType: 'bar',
      config: { ...config, title: `${config.yColumn} by ${config.xColumn}` },
      reason: 'Category + numeric → bar chart',
    }
  }

  if (numericCols.length >= 2) {
    const config = pickColumnsForChartType(result, 'scatter')
    return {
      suggestedType: 'scatter',
      config: { ...config, title: `${config.yColumn} vs ${config.xColumn}` },
      reason: 'Two numeric columns → scatter',
    }
  }

  if (numericCols.length === 1) {
    const config = pickColumnsForChartType(result, 'histogram')
    return {
      suggestedType: 'histogram',
      config: { ...config, title: `Distribution of ${config.xColumn}` },
      reason: 'Single numeric → histogram',
    }
  }

  if (stringCols.length >= 1) {
    const config = pickColumnsForChartType(result, 'bar')
    return {
      suggestedType: 'bar',
      config: { ...config, title: `Count by ${config.xColumn}` },
      reason: 'Categorical data → count bar chart',
    }
  }

  return {
    suggestedType: 'bar',
    config: pickColumnsForChartType(result, 'bar'),
    reason: 'Default bar chart',
  }
}

export type ChartTheme = 'light' | 'dark'

function themeStyles(theme: ChartTheme = 'light') {
  const isDark = theme === 'dark'
  const text = isDark ? '#FFFFFF' : '#0f172a'
  const muted = isDark ? '#D4D4D4' : '#64748b'
  const axisLine = isDark ? '#3c3c3c' : '#e2e8f0'
  const splitLine = isDark ? '#2d2d30' : '#f1f5f9'
  const tooltipBg = isDark ? '#252526' : '#ffffff'
  const tooltipBorder = isDark ? '#3c3c3c' : '#e2e8f0'

  return {
    text,
    muted,
    axisLine,
    splitLine,
    tooltipBg,
    tooltipBorder,
    axisLabel: { color: text },
    axisName: { color: muted },
    legend: {
      textStyle: { color: text },
      pageTextStyle: { color: text },
      inactiveColor: isDark ? '#666' : '#ccc',
    },
  }
}

export function buildChartOption(
  result: QueryResult,
  chartType: ChartType,
  xColumn?: string,
  yColumn?: string,
  theme: ChartTheme = 'light',
  extras?: {
    y2Column?: string
    seriesColumn?: string
    sourceColumn?: string
    targetColumn?: string
    mapId?: 'world' | 'usa-states'
  },
): Record<string, unknown> | null {
  if (chartType === 'none') return null
  if (chartType !== 'sankey' && !xColumn) return null

  const { rows } = result
  const accent = '#F2A01F'
  const styles = themeStyles(theme)
  const y2Column = extras?.y2Column
  const seriesColumn = extras?.seriesColumn
  const sourceColumn = extras?.sourceColumn
  const targetColumn = extras?.targetColumn
  const mapId = extras?.mapId ?? 'world'

  const axisCommon = {
    axisLabel: { color: styles.text },
    axisLine: { lineStyle: { color: styles.axisLine } },
    axisTick: { lineStyle: { color: styles.axisLine } },
    nameTextStyle: { color: styles.muted },
    splitLine: { lineStyle: { color: styles.splitLine } },
  }

  const baseOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger:
        chartType === 'pie' ||
        chartType === 'funnel' ||
        chartType === 'treemap' ||
        chartType === 'radar' ||
        chartType === 'sankey' ||
        chartType === 'sunburst' ||
        chartType === 'map'
          ? 'item'
          : chartType === 'heatmap'
            ? 'item'
            : 'axis',
      backgroundColor: styles.tooltipBg,
      borderColor: styles.tooltipBorder,
      textStyle: { color: styles.text },
    },
    legend: {
      ...styles.legend,
      type: 'scroll',
      top: 0,
    },
    grid: { left: 48, right: 16, top: 48, bottom: 56, containLabel: true },
    textStyle: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 12,
      color: styles.text,
    },
    color: [accent, '#2563EB', '#10B981', '#8B5CF6', '#F43F5E', '#06B6D4'],
  }

  switch (chartType) {
    case 'line':
    case 'area': {
      const xData = rows.map((r) => String(r[xColumn!]))
      const yData = yColumn ? rows.map((r) => Number(r[yColumn]) || 0) : rows.map(() => 1)
      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: xData,
          ...axisCommon,
          axisLabel: { ...axisCommon.axisLabel, rotate: xData.length > 8 ? 35 : 0 },
        },
        yAxis: { type: 'value', ...axisCommon },
        series: [
          {
            type: 'line',
            data: yData,
            smooth: true,
            showSymbol: rows.length < 40,
            ...(chartType === 'area' ? { areaStyle: { opacity: 0.35 } } : {}),
          },
        ],
      }
    }

    case 'bar': {
      const { labels, values } = aggregateByCategory(rows, xColumn!, yColumn)
      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: labels,
          ...axisCommon,
          axisLabel: { ...axisCommon.axisLabel, rotate: labels.length > 8 ? 35 : 0 },
        },
        yAxis: { type: 'value', ...axisCommon },
        series: [{ type: 'bar', data: values, itemStyle: { borderRadius: [3, 3, 0, 0] } }],
      }
    }

    case 'pie': {
      const { labels, values } = aggregateByCategory(rows, xColumn!, yColumn)
      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          backgroundColor: styles.tooltipBg,
          borderColor: styles.tooltipBorder,
          textStyle: { color: styles.text },
        },
        legend: {
          ...styles.legend,
          type: 'scroll',
          orient: 'vertical',
          right: 8,
          top: 'middle',
        },
        series: [
          {
            type: 'pie',
            radius: ['35%', '65%'],
            center: ['40%', '50%'],
            data: labels.map((name, i) => ({ name, value: values[i] })),
            label: { color: styles.text },
            labelLine: { lineStyle: { color: styles.muted } },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' },
            },
          },
        ],
      }
    }

    case 'scatter': {
      if (!yColumn) return null
      return {
        ...baseOption,
        xAxis: {
          type: 'value',
          name: xColumn,
          nameLocation: 'middle',
          nameGap: 28,
          ...axisCommon,
        },
        yAxis: {
          type: 'value',
          name: yColumn,
          nameLocation: 'middle',
          nameGap: 36,
          ...axisCommon,
        },
        series: [
          {
            type: 'scatter',
            data: rows.map((r) => [Number(r[xColumn!]) || 0, Number(r[yColumn!]) || 0]),
            symbolSize: 8,
          },
        ],
      }
    }

    case 'histogram': {
      const values = rows
        .map((r) => Number(r[xColumn!]))
        .filter((v) => Number.isFinite(v))
      if (values.length === 0) return null
      const min = Math.min(...values)
      const max = Math.max(...values)
      const bins = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(values.length))))
      const binWidth = (max - min) / bins || 1
      const histogram = Array.from({ length: bins }, () => 0)
      values.forEach((v) => {
        const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1)
        histogram[idx]++
      })
      const labels = histogram.map((_, i) => {
        const start = min + i * binWidth
        return Number.isInteger(binWidth) ? String(Math.round(start)) : start.toFixed(1)
      })
      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: labels,
          name: xColumn,
          ...axisCommon,
        },
        yAxis: {
          type: 'value',
          name: 'Frequency',
          ...axisCommon,
        },
        series: [{ type: 'bar', data: histogram, itemStyle: { borderRadius: [3, 3, 0, 0] } }],
      }
    }

    case 'funnel': {
      const { labels, values } = aggregateByCategory(rows, xColumn!, yColumn)
      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          backgroundColor: styles.tooltipBg,
          borderColor: styles.tooltipBorder,
          textStyle: { color: styles.text },
        },
        series: [
          {
            type: 'funnel',
            left: '12%',
            width: '76%',
            minSize: '15%',
            maxSize: '100%',
            sort: 'descending',
            label: { color: styles.text },
            data: labels.map((name, i) => ({ name, value: values[i] })),
          },
        ],
      }
    }

    case 'treemap': {
      const { labels, values } = aggregateByCategory(rows, xColumn!, yColumn)
      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          backgroundColor: styles.tooltipBg,
          borderColor: styles.tooltipBorder,
          textStyle: { color: styles.text },
        },
        series: [
          {
            type: 'treemap',
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: { color: '#fff', fontSize: 11 },
            data: labels.map((name, i) => ({ name, value: values[i] })),
          },
        ],
      }
    }

    case 'heatmap': {
      if (!yColumn) return null
      const valueCol =
        rows[0] && 'value' in rows[0]
          ? 'value'
          : Object.keys(rows[0] ?? {}).find((k) => k !== xColumn && k !== yColumn) ?? yColumn
      const xCats = [...new Set(rows.map((r) => String(r[xColumn!])))]
      const yCats = [...new Set(rows.map((r) => String(r[yColumn])))]
      const data = rows.map((r) => [
        xCats.indexOf(String(r[xColumn!])),
        yCats.indexOf(String(r[yColumn])),
        Number(r[valueCol]) || 0,
      ])
      const maxV = Math.max(1, ...data.map((d) => Number(d[2]) || 0))
      return {
        ...baseOption,
        tooltip: {
          position: 'top',
          backgroundColor: styles.tooltipBg,
          borderColor: styles.tooltipBorder,
          textStyle: { color: styles.text },
        },
        grid: { left: 72, right: 24, top: 40, bottom: 56, containLabel: false },
        xAxis: {
          type: 'category',
          data: xCats,
          splitArea: { show: true },
          ...axisCommon,
        },
        yAxis: {
          type: 'category',
          data: yCats,
          splitArea: { show: true },
          ...axisCommon,
        },
        visualMap: {
          min: 0,
          max: maxV,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 4,
          textStyle: { color: styles.text },
          inRange: { color: ['#fff7ed', accent, '#9a3412'] },
        },
        series: [
          {
            type: 'heatmap',
            data,
            label: { show: data.length < 80, color: styles.text, fontSize: 10 },
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.25)' } },
          },
        ],
      }
    }

    case 'radar': {
      const { labels, values } = aggregateByCategory(rows, xColumn!, yColumn)
      if (!labels.length) return null
      const maxV = Math.max(1, ...values)
      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          backgroundColor: styles.tooltipBg,
          borderColor: styles.tooltipBorder,
          textStyle: { color: styles.text },
        },
        radar: {
          indicator: labels.map((name) => ({ name, max: maxV * 1.15 })),
          axisName: { color: styles.text },
          splitLine: { lineStyle: { color: styles.splitLine } },
          splitArea: { show: false },
          axisLine: { lineStyle: { color: styles.axisLine } },
        },
        series: [
          {
            type: 'radar',
            data: [{ value: values, name: yColumn ?? 'value', areaStyle: { opacity: 0.25 } }],
          },
        ],
      }
    }

    case 'pyramid': {
      if (!yColumn || !y2Column) return null
      const bands = rows.map((r) => String(r[xColumn!]))
      const left = rows.map((r) => -(Number(r[yColumn]) || 0))
      const right = rows.map((r) => Number(r[y2Column]) || 0)
      return {
        ...baseOption,
        legend: { ...styles.legend, data: [yColumn, y2Column], top: 0 },
        grid: { left: 56, right: 56, top: 40, bottom: 32, containLabel: true },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: styles.tooltipBg,
          borderColor: styles.tooltipBorder,
          textStyle: { color: styles.text },
          formatter: (params: unknown) => {
            const list = Array.isArray(params) ? params : [params]
            const band = (list[0] as { axisValue?: string })?.axisValue ?? ''
            return [
              band,
              ...list.map((p) => {
                const item = p as { seriesName?: string; value?: number }
                const v = Math.abs(Number(item.value) || 0)
                return `${item.seriesName}: ${v}`
              }),
            ].join('<br/>')
          },
        },
        xAxis: {
          type: 'value',
          ...axisCommon,
          axisLabel: {
            ...axisCommon.axisLabel,
            formatter: (v: number) => String(Math.abs(v)),
          },
        },
        yAxis: {
          type: 'category',
          data: bands,
          ...axisCommon,
          axisTick: { show: false },
        },
        series: [
          {
            name: yColumn,
            type: 'bar',
            stack: 'pyramid',
            data: left,
            itemStyle: { color: '#2563EB' },
          },
          {
            name: y2Column,
            type: 'bar',
            stack: 'pyramid',
            data: right,
            itemStyle: { color: accent },
          },
        ],
      }
    }

    case 'stacked_bar':
    case 'stacked_area': {
      if (!xColumn || !seriesColumn || !yColumn) return null
      const cats = [...new Set(rows.map((r) => String(r[xColumn])))]
      const seriesKeys = [...new Set(rows.map((r) => String(r[seriesColumn])))]
      const lookup = new Map<string, number>()
      for (const r of rows) {
        lookup.set(`${String(r[xColumn])}||${String(r[seriesColumn])}`, Number(r[yColumn]) || 0)
      }
      return {
        ...baseOption,
        legend: { ...styles.legend, data: seriesKeys, top: 0 },
        xAxis: {
          type: 'category',
          data: cats,
          ...axisCommon,
          axisLabel: { ...axisCommon.axisLabel, rotate: cats.length > 8 ? 35 : 0 },
        },
        yAxis: { type: 'value', ...axisCommon },
        series: seriesKeys.map((sk) => ({
          name: sk,
          type: chartType === 'stacked_area' ? 'line' : 'bar',
          stack: 'total',
          ...(chartType === 'stacked_area'
            ? { areaStyle: { opacity: 0.45 }, smooth: true, showSymbol: false }
            : { itemStyle: { borderRadius: [0, 0, 0, 0] } }),
          data: cats.map((c) => lookup.get(`${c}||${sk}`) ?? 0),
        })),
      }
    }

    case 'sankey': {
      const srcCol = sourceColumn ?? xColumn
      const tgtCol = targetColumn ?? y2Column
      const valCol = yColumn ?? 'value'
      if (!srcCol || !tgtCol) return null
      const links = rows.map((r) => ({
        source: String(r[srcCol]),
        target: String(r[tgtCol]),
        value: Number(r[valCol]) || 0,
      }))
      const nodes = [
        ...new Set(links.flatMap((l) => [l.source, l.target])),
      ].map((name) => ({ name }))
      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          backgroundColor: styles.tooltipBg,
          borderColor: styles.tooltipBorder,
          textStyle: { color: styles.text },
        },
        series: [
          {
            type: 'sankey',
            emphasis: { focus: 'adjacency' },
            data: nodes,
            links,
            lineStyle: { color: 'gradient', curveness: 0.5 },
            label: { color: styles.text },
          },
        ],
      }
    }

    case 'sunburst': {
      if (!xColumn) return null
      const valCol = yColumn ?? 'value'
      const { labels, values } = aggregateByCategory(rows, xColumn, valCol === 'value' ? undefined : yColumn)
      // If path-like "A/B/C", build hierarchy; else flat ring
      const hasPath = labels.some((l) => l.includes('/'))
      let data: Record<string, unknown>[]
      if (hasPath) {
        type Node = { name: string; value?: number; children?: Node[] }
        const root: Node = { name: 'root', children: [] }
        labels.forEach((path, i) => {
          const parts = path.split('/').map((p) => p.trim()).filter(Boolean)
          let cur = root
          parts.forEach((part, idx) => {
            cur.children ??= []
            let next = cur.children.find((c) => c.name === part)
            if (!next) {
              next = { name: part, children: [] }
              cur.children.push(next)
            }
            if (idx === parts.length - 1) next.value = (next.value ?? 0) + values[i]
            cur = next
          })
        })
        data = root.children ?? []
      } else {
        data = labels.map((name, i) => ({ name, value: values[i] }))
      }
      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          backgroundColor: styles.tooltipBg,
          borderColor: styles.tooltipBorder,
          textStyle: { color: styles.text },
        },
        series: [
          {
            type: 'sunburst',
            data,
            radius: [0, '90%'],
            label: { color: styles.text, fontSize: 10 },
            itemStyle: { borderWidth: 1, borderColor: styles.tooltipBg },
          },
        ],
      }
    }

    case 'map': {
      if (!xColumn || !yColumn) return null
      const { labels, values } = aggregateByCategory(rows, xColumn, yColumn)
      const maxV = Math.max(1, ...values)
      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          backgroundColor: styles.tooltipBg,
          borderColor: styles.tooltipBorder,
          textStyle: { color: styles.text },
        },
        visualMap: {
          min: 0,
          max: maxV,
          left: 'left',
          bottom: 8,
          text: ['High', 'Low'],
          textStyle: { color: styles.text },
          inRange: { color: ['#fff7ed', accent, '#9a3412'] },
          calculable: true,
        },
        series: [
          {
            type: 'map',
            map: mapId,
            roam: true,
            data: labels.map((name, i) => ({ name, value: values[i] })),
            label: { show: false },
            emphasis: {
              label: { show: true, color: styles.text },
              itemStyle: { areaColor: '#fbbf24' },
            },
            itemStyle: {
              borderColor: styles.axisLine,
              borderWidth: 0.6,
              areaColor: styles.splitLine,
            },
          },
        ],
      }
    }

    default:
      return null
  }
}
