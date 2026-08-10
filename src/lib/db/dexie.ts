import type { Preferences } from '@/types/preferences'
import type { RecentFileMeta } from '@/types/dataset'
import type { SavedQuery } from '@/types/query'
import type { PersistedDataset } from '@/types/persistedDataset'
import type { LocalWorkspace } from '@/types/workspace'
import type { PersistedDashboardPack } from '@/types/persistedDashboardPack'
import Dexie, { type Table } from 'dexie'

export class DataCheetahDB extends Dexie {
  preferences!: Table<Preferences>
  recentFiles!: Table<RecentFileMeta>
  savedQueries!: Table<SavedQuery>
  datasetBlobs!: Table<PersistedDataset>
  workspaces!: Table<LocalWorkspace>
  dashboardPacks!: Table<PersistedDashboardPack>

  constructor() {
    super('datacheetah')
    this.version(1).stores({
      preferences: 'id',
      recentFiles: 'id, lastOpenedAt',
      savedQueries: 'id, name, updatedAt',
    })
    this.version(2).stores({
      preferences: 'id',
      recentFiles: 'id, lastOpenedAt',
      savedQueries: 'id, name, updatedAt',
      datasetBlobs: 'id, savedAt, tableName',
    })
    this.version(3)
      .stores({
        preferences: 'id',
        recentFiles: 'id, lastOpenedAt',
        savedQueries: 'id, name, updatedAt',
        datasetBlobs: 'id, workspaceId, savedAt, tableName',
        workspaces: 'id, name, updatedAt',
      })
      .upgrade(async (tx) => {
        const wsTable = tx.table('workspaces')
        const blobTable = tx.table('datasetBlobs')
        let personal = await wsTable.toCollection().first()
        if (!personal) {
          const id = crypto.randomUUID()
          personal = {
            id,
            name: 'Personal',
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          await wsTable.put(personal)
        }
        await blobTable.toCollection().modify((row: PersistedDataset) => {
          if (!row.workspaceId) {
            row.workspaceId = (personal as LocalWorkspace).id
          }
        })
      })
    this.version(4).stores({
      preferences: 'id',
      recentFiles: 'id, lastOpenedAt',
      savedQueries: 'id, name, updatedAt',
      datasetBlobs: 'id, workspaceId, savedAt, tableName',
      workspaces: 'id, name, updatedAt',
      secretsVault: 'id',
    })
    // Drop unused encrypted vault table
    this.version(5).stores({
      preferences: 'id',
      recentFiles: 'id, lastOpenedAt',
      savedQueries: 'id, name, updatedAt',
      datasetBlobs: 'id, workspaceId, savedAt, tableName',
      workspaces: 'id, name, updatedAt',
      secretsVault: null,
    })
    this.version(6).stores({
      preferences: 'id',
      recentFiles: 'id, lastOpenedAt',
      savedQueries: 'id, name, updatedAt',
      datasetBlobs: 'id, workspaceId, savedAt, tableName',
      workspaces: 'id, name, updatedAt',
      dashboardPacks: 'id, installedAt',
    })
    // Multifile Discover packs (samplesJson); sampleCsv kept for legacy rows
    this.version(7).stores({
      preferences: 'id',
      recentFiles: 'id, lastOpenedAt',
      savedQueries: 'id, name, updatedAt',
      datasetBlobs: 'id, workspaceId, savedAt, tableName',
      workspaces: 'id, name, updatedAt',
      dashboardPacks: 'id, installedAt',
    })
  }
}

export const db = new DataCheetahDB()
