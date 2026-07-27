export interface TopValue {
  value: unknown
  frequency: number
}

export interface ColumnProfile {
  columnName: string
  dataType: string
  totalRows: number
  nonNullCount: number
  nullPct: number
  distinctCount: number
  minVal: unknown
  maxVal: unknown
  avgVal: number | null
  medianVal: number | null
  topValues: TopValue[]
}

export interface TableProfile {
  tableName: string
  rowCount: number
  columnCount: number
  columns: ColumnProfile[]
  duplicateCount?: number
}
