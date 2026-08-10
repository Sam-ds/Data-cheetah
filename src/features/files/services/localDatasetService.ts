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
import { useProfileStore, usePreferencesStore } from '@/features/profiling/store/profileStore'
import { useAskStore, resetAskLlmSession } from '@/features/ask'
import { buildDefaultQuery } from '@/features/profiling/services/profilingService'
import { resetDuckDB } from '@/hooks/useDuckDB'
import {
  ensureDefaultWorkspace,
  getActiveWorkspaceIdSync,
  setActiveWorkspaceIdSync,
  touchWorkspace,
} from '@/features/workspace/services/workspaceService'
import type { RegisteredDataset } from '@/types/dataset'
import type { PersistedDataset } from '@/types/persistedDataset'

/** False until IndexedDB blobs have been registered into the current DuckDB session. */
let duckdbTablesSynced = false
let syncPromise: Promise<number> | null = null

export function markDuckDbTablesUnsynced(): void {
  duckdbTablesSynced = false
  syncPromise = null
}

export function isDuckDbTableSyncRunning(): boolean {
  return syncPromise != null
}

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

function toRegistered(record: PersistedDataset): RegisteredDataset {
  return {
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
}

/**
 * Hydrate the file list from IndexedDB only — does not start DuckDB or download WASM.
 * Used on app boot so a refresh on Home does not reload the engine.
 */
export async function hydrateFileListFromIdb(options?: {
  workspaceId?: string
}): Promise<number> {
  await ensureDefaultWorkspace()
  const workspaceId = options?.workspaceId ?? getActiveWorkspaceIdSync()
  if (!workspaceId) return 0

  const records = await listPersistedDatasets(workspaceId)
  const store = useFilesStore.getState()
  store.clearFiles()
  markDuckDbTablesUnsynced()

  if (records.length === 0) return 0

  let last: RegisteredDataset | null = null
  for (const record of records) {
    const dataset = toRegistered(record)
    useFilesStore.getState().addFile(dataset)
    last = dataset
  }
  if (last) {
    useSqlStore.getState().setEditorContent(buildDefaultQuery(last.tableName))
  }
  return records.length
}

/**
 * Register IndexedDB datasets into the live DuckDB session (starts engine if needed).
 * Safe to call repeatedly; no-ops once the current session is synced.
 */
export async function syncPersistedTablesToDuckDB(options?: {
  force?: boolean
}): Promise<number> {
  if (!options?.force && duckdbTablesSynced && duckdbClient.isReady()) {
    return useFilesStore.getState().files.length
  }
  if (syncPromise && !options?.force) return syncPromise

  syncPromise = (async () => {
    await ensureDefaultWorkspace()
    const workspaceId = getActiveWorkspaceIdSync()
    if (!workspaceId) {
      syncPromise = null
      return 0
    }

    const records = await listPersistedDatasets(workspaceId)
    if (records.length === 0) {
      duckdbTablesSynced = true
      syncPromise = null
      return 0
    }

    const store = useFilesStore.getState()
    store.setRestoringLocal(true)
    try {
      // Prefer duckdbClient.init (not ensureDuckDB) to avoid ensureDuckDB ↔ sync recursion.
      if (!duckdbClient.isReady()) {
        const limit = usePreferencesStore.getState().duckdbMemoryLimit
        duckdbClient.setMemoryLimitForNextInit(limit)
        await duckdbClient.init(limit)
        usePreferencesStore.getState().setDuckdbReady(true)
        usePreferencesStore.getState().setDuckdbStatus('ready')
      }

      let restored = 0
      let last: RegisteredDataset | null = null

      if (store.files.length === 0 || options?.force) {
        useFilesStore.getState().clearFiles()
      }

      for (const record of records) {
        try {
          const buffer = record.buffer.slice(0)
          await duckdbClient.registerFile(
            record.registerName,
            buffer,
            record.format,
            record.tableName,
          )
          const dataset = toRegistered(record)
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
      duckdbTablesSynced = true
      return restored
    } finally {
      useFilesStore.getState().setRestoringLocal(false)
      syncPromise = null
    }
  })()

  return syncPromise
}

/**
 * Re-register IndexedDB datasets for the active workspace into DuckDB and hydrate filesStore.
 */
export async function rehydratePersistedFiles(options?: {
  workspaceId?: string
  force?: boolean
}): Promise<number> {
  if (options?.workspaceId) {
    setActiveWorkspaceIdSync(options.workspaceId)
  }
  if (options?.force) {
    markDuckDbTablesUnsynced()
    await resetDuckDB()
  }
  return syncPersistedTablesToDuckDB({ force: options?.force })
}

/** Switch active workspace: unload current DuckDB session and load that workspace's datasets. */
export async function switchWorkspace(workspaceId: string): Promise<number> {
  setActiveWorkspaceIdSync(workspaceId)
  resetSessionUi()
  useFilesStore.getState().clearFiles()
  markDuckDbTablesUnsynced()
  await resetDuckDB()
  await hydrateFileListFromIdb({ workspaceId })
  return syncPersistedTablesToDuckDB({ force: true })
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
  markDuckDbTablesUnsynced()
  await resetDuckDB()
}

/** Nuclear: delete all cached datasets in every workspace. */
export async function clearAllLocalDatasets(): Promise<void> {
  await clearPersistedDatasets()
  useFilesStore.getState().clearFiles()
  resetSessionUi()
  markDuckDbTablesUnsynced()
  await resetDuckDB()
}
