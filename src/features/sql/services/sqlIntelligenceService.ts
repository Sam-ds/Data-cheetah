import { duckdbClient, sqlglotClient } from '@/services/duckdbClient'
import type { QueryResult, SqlDiagnostic } from '@/types/query'

export async function formatSql(sql: string): Promise<string> {
  return sqlglotClient.formatSql(sql)
}

export async function lintSql(sql: string): Promise<{ valid: boolean; diagnostics: SqlDiagnostic[] }> {
  return sqlglotClient.lintSql(sql)
}

export async function executeQuery(sql: string, limit?: number): Promise<QueryResult> {
  return duckdbClient.executeSql(sql, limit)
}
