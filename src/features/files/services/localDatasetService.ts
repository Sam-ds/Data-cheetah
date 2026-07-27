import { duckdbClient } from '@/services/duckdbClient'
import {
  clearPersistedDatasets,
  clearPersistedDatasetsForWorkspace,
  countPersistedDatasets,
  listPersistedDatasets,
} from '@/features/files/services/datasetPersistenceService'
import { useFilesStore } from '@/features/files/store/filesStore'
import { useSqlStore, useQueryStore, DEFAULT_SQL } from '@/features/sql/store/sqlStore'
import { useChartStore } from '@/features/charts/store/chartStore'
import { useProfileStore } from '@/features/profiling/store/profileStore'
import { useAskStore, resetAskLlmSession } from '@/features/ask'
import { buildDefaultQuery } from '@/features/profiling/services/profilingService'
import { ensureDuckDB, resetDuckDB } from '@/hooks/useDuckDB'
import {
  ensureDefaultWorkspace,
  getActiveWorkspaceIdSync,
  setActiveWorkspaceIdSync,
  touchWorkspace,
} from '@/features/workspace/services/workspaceService'
import type { RegisteredDataset } from '@/types/dataset'

export async function hasPersistedDatasets(workspaceId?: string): Promise<boolean> {
  const wsId = workspaceId ?? getActiveWorkspaceIdSync() ?? undefined
  return (await countPersistedDatasets(wsId)) > 0
}

function resetSessionUi(keepAsk = false) {
  useSqlStore.getState().setEditorContent(DEFAULT_SQL)
  useSqlStore.getState().setDiagnostics([])
  useQueryStore.getState().setResult(null)
  useQueryStore.getState().setError(null)
  useChartStore.getState().reset()
  useProfileStore.getState().setProfile(null)
  if (!keepAsk) {
    useAskStore.getState().resetSession()
    void resetAskLlmSession()
  }
}

/**
 * Re-register IndexedDB datasets for the active workspace into DuckDB and hydrate filesStore.
 */
export async function rehydratePersistedFiles(options?: {
  workspaceId?: string
  force?: boolean
}): Promise<number> {
  await ensureDefaultWorkspace()
  const workspaceId = options?.workspaceId ?? getActiveWorkspaceIdSync()
  if (!workspaceId) return 0

  const records = await listPersistedDatasets(workspaceId)
  if (records.length === 0) {
    if (options?.force) {
      useFilesStore.getState().clearFiles()
    }
    return 0
  }

  const store = useFilesStore.getState()
  if (!options?.force && store.files.length > 0) {
    return 0
  }

  store.setRestoringLocal(true)
  try {
    if (options?.force) {
      useFilesStore.getState().clearFiles()
      await resetDuckDB()
    }

    await ensureDuckDB()

    let restored = 0
    let last: RegisteredDataset | null = null

    for (const record of records) {
      try {
        const buffer = record.buffer.slice(0)
        await duckdbClient.registerFile(
          record.registerName,
          buffer,
          record.format,
          record.tableName,
        )
        const dataset: RegisteredDataset = {
          id: record.id,
          fileName: record.fileName,
          fileSize: record.fileSize,
          format: record.format,
          tableName: record.tableName,
          schema: record.schema,
          rowCount: record.rowCount,
          registeredAt: record.savedAt,
          schemaDoc: record.schemaDoc,
        }
        useFilesStore.getState().addFile(dataset)
        last = dataset
        restored += 1
      } catch (err) {
        console.warn(`Failed to restore dataset ${record.fileName}`, err)
      }
    }

    if (last) {
      useSqlStore.getState().setEditorContent(buildDefaultQuery(last.tableName))
    }

    await touchWorkspace(workspaceId)
    return restored
  } finally {
    useFilesStore.getState().setRestoringLocal(false)
  }
}

/** Switch active workspace: unload current DuckDB session and load that workspace's datasets. */
export async function switchWorkspace(workspaceId: string): Promise<number> {
  setActiveWorkspaceIdSync(workspaceId)
  resetSessionUi()
  useFilesStore.getState().clearFiles()
  await resetDuckDB()
  return rehydratePersistedFiles({ workspaceId, force: true })
}

/** Clear datasets in the current workspace only (theme/saved SQL kept). */
export async function clearLocalDatasets(): Promise<void> {
  const workspaceId = getActiveWorkspaceIdSync()
  if (workspaceId) {
    await clearPersistedDatasetsForWorkspace(workspaceId)
  } else {
    await clearPersistedDatasets()
  }
  useFilesStore.getState().clearFiles()
  resetSessionUi()
  await resetDuckDB()
}

/** Nuclear: delete all cached datasets in every workspace. */
export async function clearAllLocalDatasets(): Promise<void> {
  await clearPersistedDatasets()
  useFilesStore.getState().clearFiles()
  resetSessionUi()
  await resetDuckDB()
}
