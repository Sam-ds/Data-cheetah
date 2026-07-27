import { duckdbClient } from '@/services/duckdbClient'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'

const ENGINE_SEEN_KEY = 'datacheetah-duckdb-seen'

let initPromise: Promise<void> | null = null

/** True after DuckDB has successfully initialized at least once in this browser. */
export function hasSeenDuckDBEngine(): boolean {
  try {
    return localStorage.getItem(ENGINE_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markDuckDBEngineSeen() {
  try {
    localStorage.setItem(ENGINE_SEEN_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

/** Load DuckDB WASM only when first needed (file import / query). */
export async function ensureDuckDB(): Promise<void> {
  const { duckdbReady, duckdbStatus, setDuckdbStatus, setDuckdbReady } = usePreferencesStore.getState()
  if (duckdbReady || duckdbStatus === 'ready') return

  if (!initPromise) {
    setDuckdbStatus('loading')
    initPromise = duckdbClient
      .init()
      .then(() => {
        markDuckDBEngineSeen()
        setDuckdbReady(true)
        setDuckdbStatus('ready')
      })
      .catch((err) => {
        initPromise = null
        setDuckdbReady(false)
        setDuckdbStatus('error')
        throw err
      })
  }

  return initPromise
}

export function useDuckDB() {
  const duckdbReady = usePreferencesStore((s) => s.duckdbReady)
  const duckdbStatus = usePreferencesStore((s) => s.duckdbStatus)
  return { ready: duckdbReady, status: duckdbStatus, ensureDuckDB, hasSeenDuckDBEngine }
}
