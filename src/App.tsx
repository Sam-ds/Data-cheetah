import { WorkspaceLayout } from '@/features/workspace/components/WorkspaceLayout'
import { ToolsOverlay } from '@/features/tools/components/ToolsOverlay'
import { useDuckDB } from '@/hooks/useDuckDB'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useEffect } from 'react'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { loadPreferences } from '@/services/storageService'
import { Toaster } from 'sonner'

function App() {
  useDuckDB()
  useKeyboardShortcuts()
  const setTheme = usePreferencesStore((s) => s.setTheme)

  useEffect(() => {
    // Clear stale SQL from older builds that persisted editor content across reloads.
    // DuckDB tables are in-memory and do not survive refresh.
    try {
      localStorage.removeItem('datacheetah-sql')
      localStorage.removeItem('datacheetah-workspace')
      localStorage.removeItem('datacheetah-workspace-v2')
    } catch {
      /* ignore */
    }
    loadPreferences().then((prefs) => {
      setTheme(prefs.theme)
    })
  }, [setTheme])

  return (
    <>
      <WorkspaceLayout />
      <ToolsOverlay />
      <Toaster position="bottom-right" richColors closeButton />
    </>
  )
}

export default App
