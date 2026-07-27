import Dexie, { type Table } from 'dexie'
import type { Preferences } from '@/types/preferences'
import type { RecentFileMeta } from '@/types/dataset'
import type { SavedQuery } from '@/types/query'

export class DataCheetahDB extends Dexie {
  preferences!: Table<Preferences>
  recentFiles!: Table<RecentFileMeta>
  savedQueries!: Table<SavedQuery>

  constructor() {
    super('datacheetah')
    this.version(1).stores({
      preferences: 'id',
      recentFiles: 'id, lastOpenedAt',
      savedQueries: 'id, name, updatedAt',
    })
  }
}

export const db = new DataCheetahDB()
