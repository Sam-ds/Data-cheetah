import { duckdbClient } from '@/services/duckdbClient'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'

let initPromise: Promise<void> | null = null

/** Load DuckDB WASM only when first needed (file import / query). */
export async function ensureDuckDB(): Promise<void> {
  const { duckdbReady, duckdbStatus, setDuckdbStatus, setDuckdbReady } = usePreferencesStore.getState()
  if (duckdbReady || duckdbStatus === 'ready') return

  if (!initPromise) {
    setDuckdbStatus('loading')
    initPromise = duckdbClient
      .init()
      .then(() => {
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
  return { ready: duckdbReady, status: duckdbStatus, ensureDuckDB }
}
