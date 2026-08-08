import { db } from '@/lib/db/dexie'
import { DEFAULT_PREFERENCES, type Preferences } from '@/types/preferences'
import { coerceAskProvider } from '@/types/askSettings'
import type { RecentFileMeta } from '@/types/dataset'
import type { SavedQuery } from '@/types/query'

export async function loadPreferences(): Promise<Preferences> {
  const stored = await db.preferences.get('default')
  if (!stored) return { ...DEFAULT_PREFERENCES }
  return {
    ...DEFAULT_PREFERENCES,
    ...stored,
    askProvider: coerceAskProvider(stored.askProvider),
    openrouterApiKey: stored.openrouterApiKey ?? '',
    layout: { ...DEFAULT_PREFERENCES.layout, ...stored.layout },
    editorSettings: { ...DEFAULT_PREFERENCES.editorSettings, ...stored.editorSettings },
  }
}

export async function savePreferences(prefs: Partial<Preferences>): Promise<void> {
  const current = await loadPreferences()
  await db.preferences.put({
    ...current,
    ...prefs,
    layout: { ...current.layout, ...prefs.layout },
    editorSettings: { ...current.editorSettings, ...prefs.editorSettings },
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
