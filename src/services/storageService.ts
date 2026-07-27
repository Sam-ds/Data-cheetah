import { db } from '@/lib/db/dexie'
import { DEFAULT_PREFERENCES, type Preferences } from '@/types/preferences'
import type { RecentFileMeta } from '@/types/dataset'
import type { SavedQuery } from '@/types/query'

export async function loadPreferences(): Promise<Preferences> {
  const stored = await db.preferences.get('default')
  return stored ?? DEFAULT_PREFERENCES
}

export async function savePreferences(prefs: Partial<Preferences>): Promise<void> {
  const current = await loadPreferences()
  await db.preferences.put({
    ...current,
    ...prefs,
    id: 'default',
    updatedAt: new Date(),
  })
}

export async function getRecentFiles(): Promise<RecentFileMeta[]> {
  return db.recentFiles.orderBy('lastOpenedAt').reverse().limit(20).toArray()
}

export async function saveRecentFile(meta: RecentFileMeta): Promise<void> {
  await db.recentFiles.put(meta)
}

export async function getSavedQueries(): Promise<SavedQuery[]> {
  return db.savedQueries.orderBy('updatedAt').reverse().toArray()
}

export async function saveQuery(query: SavedQuery): Promise<void> {
  await db.savedQueries.put(query)
}

export async function deleteSavedQuery(id: string): Promise<void> {
  await db.savedQueries.delete(id)
}
