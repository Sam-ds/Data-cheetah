import { useFilesStore } from '@/features/files/store/filesStore'
import { useSqlStore, useQueryStore, DEFAULT_SQL } from '@/features/sql/store/sqlStore'
import { useChartStore } from '@/features/charts/store/chartStore'
import { useProfileStore } from '@/features/profiling/store/profileStore'
import { useToolsStore } from '@/features/tools/store/toolsStore'

/** Clear workspace state and return to the home empty state. */
export function goHome() {
  useFilesStore.getState().clearFiles()
  useSqlStore.getState().setEditorContent(DEFAULT_SQL)
  useSqlStore.getState().setDiagnostics([])
  useQueryStore.getState().setResult(null)
  useQueryStore.getState().setError(null)
  useChartStore.getState().reset()
  useProfileStore.getState().setProfile(null)
  useToolsStore.getState().close()
}
