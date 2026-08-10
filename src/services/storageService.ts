import { db } from '@/lib/db/dexie'
import { DEFAULT_PREFERENCES, type Preferences } from '@/types/preferences'
import { coerceAskProvider } from '@/types/askSettings'
import type { RecentFileMeta } from '@/types/dataset'
import type { SavedQuery } from '@/types/query'

const ZUSTAND_PREFS_KEY = 'datacheetah-preferences'

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

/** Read OpenRouter key from IndexedDB immediately before a network request. */
export async function getOpenRouterApiKey(): Promise<string | undefined> {
  const prefs = await loadPreferences()
  const key = prefs.openrouterApiKey?.trim()
  return key || undefined
}

/** Wipe only the API key from IndexedDB (does not delete datasets/workspaces). */
export async function clearOpenRouterApiKey(): Promise<void> {
  await savePreferences({ openrouterApiKey: '' })
  scrubOpenRouterKeyFromLocalStorage()
}

function readLegacyKeyFromLocalStorage(): string {
  try {
    const raw = localStorage.getItem(ZUSTAND_PREFS_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { state?: { openrouterApiKey?: string }; openrouterApiKey?: string }
    const key = parsed.state?.openrouterApiKey ?? parsed.openrouterApiKey ?? ''
    return typeof key === 'string' ? key.trim() : ''
  } catch {
    return ''
  }
}

/** Remove any OpenRouter key leftover in Zustand's localStorage blob. */
export function scrubOpenRouterKeyFromLocalStorage(): void {
  try {
    const raw = localStorage.getItem(ZUSTAND_PREFS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, unknown>
    let changed = false
    if (parsed && typeof parsed === 'object') {
      if ('openrouterApiKey' in parsed) {
        delete parsed.openrouterApiKey
        changed = true
      }
      const state = parsed.state
      if (state && typeof state === 'object') {
        const s = state as Record<string, unknown>
        if ('openrouterApiKey' in s) {
          delete s.openrouterApiKey
          changed = true
        }
      }
    }
    if (changed) localStorage.setItem(ZUSTAND_PREFS_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}

/**
 * One-time migrate: copy key from localStorage → IndexedDB if IDB is empty,
 * then scrub localStorage so the key is IndexedDB-only.
 */
export async function migrateOpenRouterKeyFromLocalStorage(): Promise<void> {
  const legacy = readLegacyKeyFromLocalStorage()
  const current = await loadPreferences()
  if (legacy && !current.openrouterApiKey?.trim()) {
    await savePreferences({ openrouterApiKey: legacy })
  }
  scrubOpenRouterKeyFromLocalStorage()
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
