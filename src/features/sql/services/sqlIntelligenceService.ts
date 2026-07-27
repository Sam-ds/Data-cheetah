import { duckdbClient, sqlglotClient } from '@/services/duckdbClient'
import type { QueryResult, SqlDiagnostic } from '@/types/query'

export async function formatSql(sql: string): Promise<string> {
  return sqlglotClient.formatSql(sql)
}

export async function lintSql(sql: string): Promise<{ valid: boolean; diagnostics: SqlDiagnostic[] }> {
  return sqlglotClient.lintSql(sql)
}

function isMissingTableError(message: string): boolean {
  return /does not exist|Catalog Error|Table with name|not found/i.test(message)
}

/** Run SQL; if the engine was reset and tables vanished, restore from local cache once and retry. */
export async function executeQuery(sql: string, limit?: number): Promise<QueryResult> {
  try {
    return await duckdbClient.executeSql(sql, limit)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!isMissingTableError(message)) throw err

    const { resetDuckDB, ensureDuckDB } = await import('@/hooks/useDuckDB')
    const { rehydratePersistedFiles } = await import(
      '@/features/files/services/localDatasetService'
    )

    await resetDuckDB()
    await ensureDuckDB()
    const restored = await rehydratePersistedFiles({ force: true })
    if (restored === 0) throw err

    return duckdbClient.executeSql(sql, limit)
  }
}
