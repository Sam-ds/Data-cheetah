import { useCallback } from 'react'
import { formatSql, lintSql, executeQuery } from '@/features/sql/services/sqlIntelligenceService'
import { useSqlStore, useQueryStore } from '@/features/sql/store/sqlStore'
import { useChartStore } from '@/features/charts/store/chartStore'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { inferChart, buildChartOption } from '@/features/charts/services/chartInferenceService'
import { toast } from 'sonner'

export function useSqlEditor() {
  const { editorContent, diagnostics, isRunning, setEditorContent, setDiagnostics, setIsRunning } =
    useSqlStore()
  const { result, error, setResult, setError } = useQueryStore()
  const { setInferred, setSelectedType, setChartOption } = useChartStore()
  const setActiveBottomTab = useWorkspaceStore((s) => s.setActiveBottomTab)
  const theme = usePreferencesStore((s) => s.theme)
  const defaultRowLimit = usePreferencesStore((s) => s.defaultRowLimit)

  const runQuery = useCallback(async () => {
    if (!editorContent.trim()) return

    setIsRunning(true)
    setError(null)

    try {
      const lintResult = await lintSql(editorContent)
      setDiagnostics(lintResult.diagnostics)

      if (!lintResult.valid) {
        toast.error('SQL syntax error — fix before running')
        return
      }

      const queryResult = await executeQuery(editorContent, defaultRowLimit)
      setResult(queryResult)

      const inferred = inferChart(queryResult)
      setInferred(inferred)
      setSelectedType(inferred.suggestedType)
      const option = buildChartOption(
        queryResult,
        inferred.suggestedType,
        inferred.config.xColumn,
        inferred.config.yColumn,
        theme,
      )
      setChartOption(option as import('echarts').EChartsOption | null)

      if (inferred.suggestedType !== 'none') {
        setActiveBottomTab('charts')
      } else {
        setActiveBottomTab('results')
      }

      toast.success(`Query completed in ${queryResult.durationMs.toFixed(0)}ms`)
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Query failed'
      if (/does not exist|Catalog Error|Table with name/i.test(message)) {
        message =
          'Table not found. Datasets are in-memory only — drop or open the file again, then run the query.'
      }
      setError(message)
      toast.error(message)
      setActiveBottomTab('results')
    } finally {
      setIsRunning(false)
    }
  }, [
    editorContent,
    defaultRowLimit,
    theme,
    setIsRunning,
    setError,
    setDiagnostics,
    setResult,
    setInferred,
    setSelectedType,
    setChartOption,
    setActiveBottomTab,
  ])

  const handleFormat = useCallback(async () => {
    try {
      const formatted = await formatSql(editorContent)
      setEditorContent(formatted)
      toast.success('SQL formatted')
    } catch {
      toast.error('Format failed')
    }
  }, [editorContent, setEditorContent])

  const handleLint = useCallback(async () => {
    const lintResult = await lintSql(editorContent)
    setDiagnostics(lintResult.diagnostics)
  }, [editorContent, setDiagnostics])

  return {
    sql: editorContent,
    setSql: setEditorContent,
    diagnostics,
    isRunning,
    result,
    error,
    runQuery,
    formatSql: handleFormat,
    lintSql: handleLint,
  }
}
