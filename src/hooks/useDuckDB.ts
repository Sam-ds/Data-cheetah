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

/** Load DuckDB WASM only when first needed (file import / query / restore). */
export async function ensureDuckDB(): Promise<void> {
  const { duckdbMemoryLimit, setDuckdbStatus, setDuckdbReady } = usePreferencesStore.getState()

  if (duckdbClient.isReady()) return

  if (!initPromise) {
    setDuckdbStatus('loading')
    duckdbClient.setMemoryLimitForNextInit(duckdbMemoryLimit)
    initPromise = duckdbClient
      .init(duckdbMemoryLimit)
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

/** Tear down DuckDB so the next ensureDuckDB() starts a fresh engine (used by Clear local data). */
export async function resetDuckDB(): Promise<void> {
  duckdbClient.dispose()
  initPromise = null
  const { setDuckdbReady, setDuckdbStatus } = usePreferencesStore.getState()
  setDuckdbReady(false)
  setDuckdbStatus('idle')
}

export function useDuckDB() {
  const duckdbReady = usePreferencesStore((s) => s.duckdbReady)
  const duckdbStatus = usePreferencesStore((s) => s.duckdbStatus)
  return { ready: duckdbReady, status: duckdbStatus, ensureDuckDB, hasSeenDuckDBEngine, resetDuckDB }
}
