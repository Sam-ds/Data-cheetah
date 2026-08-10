import { WorkspaceLayout } from '@/features/workspace/components/WorkspaceLayout'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useUiClickSound } from '@/hooks/useUiClickSound'
import { useEffect, useRef } from 'react'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import {
  loadPreferences,
  migrateOpenRouterKeyFromLocalStorage,
} from '@/services/storageService'
import { hydrateFileListFromIdb } from '@/features/files/services/localDatasetService'
import { ensureDefaultWorkspace } from '@/features/workspace/services/workspaceService'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { Toaster, toast } from 'sonner'

function App() {
  useKeyboardShortcuts()
  useUiClickSound()
  const setTheme = usePreferencesStore((s) => s.setTheme)
  const hydrateFromPreferences = usePreferencesStore((s) => s.hydrateFromPreferences)
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const restoredRef = useRef(false)

  useEffect(() => {
    try {
      localStorage.removeItem('datacheetah-sql')
      localStorage.removeItem('datacheetah-workspace')
      localStorage.removeItem('datacheetah-workspace-v2')
      localStorage.removeItem('datacheetah-workspace-v3')
    } catch {
      /* ignore */
    }
    void (async () => {
      await migrateOpenRouterKeyFromLocalStorage()
      const prefs = await loadPreferences()
      setTheme(prefs.theme)
      hydrateFromPreferences({
        theme: prefs.theme,
        defaultRowLimit: prefs.defaultRowLimit,
        duckdbMemoryLimit: prefs.duckdbMemoryLimit,
        askProvider: prefs.askProvider,
        askRemoteModelId: prefs.askRemoteModelId,
        openrouterApiKey: prefs.openrouterApiKey,
      })
    })()
  }, [hydrateFromPreferences, setTheme])

  useEffect(() => {
    // Always open on the home hub (not Explore / Tools / Settings)
    setAppMode('home')
  }, [setAppMode])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    void (async () => {
      try {
        await ensureDefaultWorkspace()
        // Metadata only — do not start DuckDB/WASM on every refresh.
        const n = await hydrateFileListFromIdb()
        if (n > 0) {
          toast.success(
            `${n} local dataset${n === 1 ? '' : 's'} ready — SQL engine loads when you Explore or query`,
          )
        }
      } catch (err) {
        console.warn('Local dataset restore failed', err)
        toast.error(
          err instanceof Error
            ? `Could not restore local datasets: ${err.message}`
            : 'Could not restore local datasets',
        )
      }
    })()
  }, [])

  return (
    <>
      <WorkspaceLayout />
      <Toaster position="bottom-right" richColors closeButton />
    </>
  )
}

export default App
