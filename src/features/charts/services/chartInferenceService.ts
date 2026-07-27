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
      return {
        type: 'line',
        xColumn: preferred?.xColumn && temporalCols.includes(preferred.xColumn)
          ? preferred.xColumn
          : temporalCols[0] ?? stringCols[0] ?? columns[0],
        yColumn: preferred?.yColumn && numericCols.includes(preferred.yColumn)
          ? preferred.yColumn
          : numericCols[0] ?? columns[1],
      }
    case 'bar':
    case 'pie':
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
): Record<string, unknown> | null {
  if (chartType === 'none' || !xColumn) return null

  const { rows } = result
  const accent = '#F2A01F'
  const styles = themeStyles(theme)

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
      trigger: chartType === 'pie' ? 'item' : 'axis',
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
    case 'line': {
      const xData = rows.map((r) => String(r[xColumn]))
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
        series: [{ type: 'line', data: yData, smooth: true, showSymbol: rows.length < 40 }],
      }
    }

    case 'bar': {
      const { labels, values } = aggregateByCategory(rows, xColumn, yColumn)
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
      const { labels, values } = aggregateByCategory(rows, xColumn, yColumn)
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
            data: rows.map((r) => [Number(r[xColumn]) || 0, Number(r[yColumn]) || 0]),
            symbolSize: 8,
          },
        ],
      }
    }

    case 'histogram': {
      const values = rows
        .map((r) => Number(r[xColumn]))
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

    default:
      return null
  }
}
