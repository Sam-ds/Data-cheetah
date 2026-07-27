import { useEffect } from 'react'
import { duckdbClient } from '@/services/duckdbClient'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'

export function useDuckDB() {
  const { duckdbReady, setDuckdbReady } = usePreferencesStore()

  useEffect(() => {
    duckdbClient.init().then(() => setDuckdbReady(true)).catch(console.error)
  }, [setDuckdbReady])

  return { ready: duckdbReady }
}
