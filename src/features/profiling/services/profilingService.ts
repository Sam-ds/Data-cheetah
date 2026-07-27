import { duckdbClient } from '@/services/duckdbClient'
import type { TableProfile } from '@/types/profile'

export async function profileTable(tableName: string): Promise<TableProfile> {
  const { columns, duplicateCount } = await duckdbClient.profileTable(tableName)

  return {
    tableName,
    rowCount: columns[0]?.totalRows ?? 0,
    columnCount: columns.length,
    columns,
    duplicateCount,
  }
}

export function buildDefaultQuery(tableName: string, limit = 100): string {
  return `SELECT * FROM "${tableName}" LIMIT ${limit};`
}
