import { useCallback } from 'react'
import { importFile, validateFile } from '@/features/files/services/fileImportService'
import {
  isSchemaDocFileName,
  readSchemaDocFromFile,
} from '@/features/files/services/schemaDocService'
import {
  collectFilesFromDataTransfer,
  confirmLargeFolderLoad,
  filterFolderImportFiles,
  formatBytes,
  FOLDER_SIZE_WARN_BYTES,
  totalFileBytes,
} from '@/features/files/services/folderImport'
import { buildDefaultQuery } from '@/features/profiling/services/profilingService'
import { profileTable } from '@/features/profiling/services/profilingService'
import { useFilesStore } from '@/features/files/store/filesStore'
import { useSqlStore } from '@/features/sql/store/sqlStore'
import { useProfileStore, usePreferencesStore } from '@/features/profiling/store/profileStore'
import { ensureDuckDB, hasSeenDuckDBEngine } from '@/hooks/useDuckDB'
import { toast } from 'sonner'

export function useFileImport() {
  const { files, activeFileId, importStatus, importError, addFile, setActiveFile, setImportStatus, getActiveFile, attachSchemaDocByTableName } =
    useFilesStore()
  const setEditorContent = useSqlStore((s) => s.setEditorContent)
  const setProfile = useProfileStore((s) => s.setProfile)
  const setProfileLoading = useProfileStore((s) => s.setIsLoading)

  const attachSchemaFiles = useCallback(
    async (schemaFiles: File[]) => {
      for (const file of schemaFiles) {
        try {
          const docs = await readSchemaDocFromFile(file)
          const attached: string[] = []
          const missed: string[] = []
          for (const doc of docs) {
            const table = attachSchemaDocByTableName(doc)
            if (table) attached.push(table)
            else missed.push(doc.table)
          }
          if (attached.length) {
            toast.success(
              `Descriptions applied to ${attached.length} table${attached.length === 1 ? '' : 's'}: ${attached.join(', ')}`,
            )
          }
          if (missed.length) {
            toast.error(`No loaded table matched: ${missed.join(', ')}`)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid schema description'
          toast.error(`${file.name}: ${message}`)
        }
      }
    },
    [attachSchemaDocByTableName],
  )

  const handleImport = useCallback(
    async (file: File) => {
      if (isSchemaDocFileName(file.name)) {
        await attachSchemaFiles([file])
        return
      }

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
        toast.success(
          dataset.replaced
            ? `Updated ${file.name} (${dataset.rowCount.toLocaleString()} rows)`
            : `Loaded ${file.name} (${dataset.rowCount.toLocaleString()} rows)`,
        )
        if (dataset.persistWarning) {
          toast.warning(
            `Saved in session only — could not cache for refresh: ${dataset.persistWarning}`,
          )
        }

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
    [addFile, attachSchemaFiles, setEditorContent, setImportStatus, setProfile, setProfileLoading],
  )

  const handleFiles = useCallback(
    async (list: FileList | File[], opts?: { fromFolder?: boolean }) => {
      const raw = Array.from(list)
      if (raw.length === 0) return

      const { supported, skipped } = filterFolderImportFiles(raw)
      if (supported.length === 0) {
        toast.error(
          opts?.fromFolder
            ? 'No supported files in that folder (CSV, Parquet, JSON, Excel, or *.schema.json).'
            : 'No supported files selected.',
        )
        return
      }

      const total = totalFileBytes(supported)
      if (total > FOLDER_SIZE_WARN_BYTES) {
        toast.warning(
          `About ${formatBytes(total)} selected (over 5 GB). Prefer keeping only the files you need.`,
          { duration: 8000 },
        )
        if (!confirmLargeFolderLoad(supported)) {
          toast.message('Folder load cancelled')
          return
        }
      }

      if (opts?.fromFolder || supported.length > 1) {
        toast.message(
          `Loading ${supported.length.toLocaleString()} file${supported.length === 1 ? '' : 's'} on this device` +
            (skipped ? ` (${skipped} skipped)` : '') +
            ` · ${formatBytes(total)}`,
        )
      }

      const schemaFiles = supported.filter((f) => isSchemaDocFileName(f.name))
      const dataFiles = supported.filter((f) => !isSchemaDocFileName(f.name))
      for (const file of dataFiles) {
        await handleImport(file)
      }
      if (schemaFiles.length) {
        await attachSchemaFiles(schemaFiles)
      }
    },
    [attachSchemaFiles, handleImport],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      void (async () => {
        try {
          const files = await collectFilesFromDataTransfer(e.dataTransfer)
          const fromFolder = Array.from(e.dataTransfer.items ?? []).some((item) => {
            const entry = (
              item as DataTransferItem & { webkitGetAsEntry?: () => { isDirectory?: boolean } | null }
            ).webkitGetAsEntry?.()
            return Boolean(entry?.isDirectory)
          })
          await handleFiles(files, { fromFolder })
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not read dropped files')
        }
      })()
    },
    [handleFiles],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        void handleFiles(e.target.files)
      }
      e.target.value = ''
    },
    [handleFiles],
  )

  const handleFolderInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        void handleFiles(e.target.files, { fromFolder: true })
      }
      e.target.value = ''
    },
    [handleFiles],
  )

  return {
    files,
    activeFile: getActiveFile(),
    activeFileId,
    importStatus,
    importError,
    handleImport,
    handleFiles,
    handleDrop,
    handleFileInput,
    handleFolderInput,
    setActiveFile,
  }
}
