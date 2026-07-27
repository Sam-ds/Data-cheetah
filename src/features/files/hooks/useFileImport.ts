import { useCallback } from 'react'
import { importFile, validateFile } from '@/features/files/services/fileImportService'
import { buildDefaultQuery } from '@/features/profiling/services/profilingService'
import { profileTable } from '@/features/profiling/services/profilingService'
import { useFilesStore } from '@/features/files/store/filesStore'
import { useSqlStore } from '@/features/sql/store/sqlStore'
import { useProfileStore, usePreferencesStore } from '@/features/profiling/store/profileStore'
import { ensureDuckDB, hasSeenDuckDBEngine } from '@/hooks/useDuckDB'
import { toast } from 'sonner'

export function useFileImport() {
  const { files, activeFileId, importStatus, importError, addFile, setActiveFile, setImportStatus, getActiveFile } =
    useFilesStore()
  const setEditorContent = useSqlStore((s) => s.setEditorContent)
  const setProfile = useProfileStore((s) => s.setProfile)
  const setProfileLoading = useProfileStore((s) => s.setIsLoading)

  const handleImport = useCallback(
    async (file: File) => {
      if (!validateFile(file)) {
        toast.error(`Unsupported file: ${file.name}`)
        return
      }

      setImportStatus('loading')
      try {
        const alreadyReady = usePreferencesStore.getState().duckdbReady
        if (!alreadyReady) {
          const firstTime = !hasSeenDuckDBEngine()
          toast.info(
            firstTime
              ? 'Downloading SQL engine (~10 MB) — one-time, stays in your browser'
              : 'Starting SQL engine…',
            {
              duration: firstTime ? 8000 : 4000,
              id: 'duckdb-download',
            },
          )
        }

        await ensureDuckDB()
        toast.dismiss('duckdb-download')

        const dataset = await importFile(file)
        addFile(dataset)
        setEditorContent(buildDefaultQuery(dataset.tableName))
        toast.success(`Loaded ${file.name} (${dataset.rowCount.toLocaleString()} rows)`)

        setProfileLoading(true)
        profileTable(dataset.tableName)
          .then(setProfile)
          .catch(() => setProfile(null))
      } catch (error) {
        toast.dismiss('duckdb-download')
        const message = error instanceof Error ? error.message : 'Import failed'
        setImportStatus('error', message)
        toast.error(message)
      }
    },
    [addFile, setEditorContent, setImportStatus, setProfile, setProfileLoading],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleImport(file)
    },
    [handleImport],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleImport(file)
      e.target.value = ''
    },
    [handleImport],
  )

  return {
    files,
    activeFile: getActiveFile(),
    activeFileId,
    importStatus,
    importError,
    handleImport,
    handleDrop,
    handleFileInput,
    setActiveFile,
  }
}
