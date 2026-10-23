import { db } from '@/lib/db/dexie'
import { DEFAULT_PREFERENCES, type Preferences } from '@/types/preferences'
import { coerceAskProvider } from '@/types/askSettings'
import type { RecentFileMeta } from '@/types/dataset'
import type { SavedQuery } from '@/types/query'
import { deleteSecret, getSecret, putSecret } from '@/lib/crypto/originVault'

const ZUSTAND_PREFS_KEY = 'datacheetah-preferences'
const OPENROUTER_SECRET = 'openrouter-api-key' as const

function withoutPersistedKey(prefs: Preferences): Preferences {
  return { ...prefs, openrouterApiKey: '' }
}

async function loadPreferenceRow(): Promise<Preferences> {
  const stored = await db.preferences.get('default')
  if (!stored) return { ...DEFAULT_PREFERENCES }
  return {
    ...DEFAULT_PREFERENCES,
    ...stored,
    askProvider: coerceAskProvider(stored.askProvider),
    openrouterApiKey: '',
    layout: { ...DEFAULT_PREFERENCES.layout, ...stored.layout },
    editorSettings: { ...DEFAULT_PREFERENCES.editorSettings, ...stored.editorSettings },
  }
}

/** Move any leftover plaintext key into the encrypted vault and wipe the preferences field. */
async function migratePlaintextKeyIntoVault(): Promise<void> {
  const stored = await db.preferences.get('default')
  const legacy = stored?.openrouterApiKey?.trim() ?? ''
  if (!legacy) return
  const existing = await getSecret(OPENROUTER_SECRET)
  if (!existing) await putSecret(OPENROUTER_SECRET, legacy)
  const storedInVault = await getSecret(OPENROUTER_SECRET)
  if (!storedInVault || !stored) return
  await db.preferences.put({
    ...stored,
    id: 'default',
    openrouterApiKey: '',
    updatedAt: new Date(),
  })
}

export async function loadPreferences(): Promise<Preferences> {
  await migratePlaintextKeyIntoVault()
  const stored = await loadPreferenceRow()
  const openrouterApiKey = await getSecret(OPENROUTER_SECRET)
  return { ...stored, openrouterApiKey }
}

export async function savePreferences(prefs: Partial<Preferences>): Promise<void> {
  const current = await loadPreferenceRow()
  if ('openrouterApiKey' in prefs) {
    await putSecret(OPENROUTER_SECRET, prefs.openrouterApiKey ?? '')
  }
  const { openrouterApiKey: _neverPersist, ...rest } = prefs
  await db.preferences.put(
    withoutPersistedKey({
      ...current,
      ...rest,
      layout: { ...current.layout, ...prefs.layout },
      editorSettings: { ...current.editorSettings, ...prefs.editorSettings },
      id: 'default',
      updatedAt: new Date(),
    }),
  )
}

/** Read OpenRouter key from the encrypted vault immediately before a network request. */
export async function getOpenRouterApiKey(): Promise<string | undefined> {
  await migratePlaintextKeyIntoVault()
  const key = (await getSecret(OPENROUTER_SECRET)).trim()
  return key || undefined
}

/** Wipe only the API key from the vault (does not delete datasets/workspaces). */
export async function clearOpenRouterApiKey(): Promise<void> {
  await deleteSecret(OPENROUTER_SECRET)
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
 * One-time migrate: copy key from localStorage → encrypted vault if empty,
 * then scrub localStorage so the key is never left in plaintext.
 */
export async function migrateOpenRouterKeyFromLocalStorage(): Promise<void> {
  const legacy = readLegacyKeyFromLocalStorage()
  if (legacy) {
    const current = await getSecret(OPENROUTER_SECRET)
    if (!current) await putSecret(OPENROUTER_SECRET, legacy)
  }
  await migratePlaintextKeyIntoVault()
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
