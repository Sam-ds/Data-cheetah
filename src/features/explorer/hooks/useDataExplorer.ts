import { useCallback, useEffect, useState } from 'react'
import { useFilesStore } from '@/features/files/store/filesStore'
import { duckdbClient } from '@/services/duckdbClient'
import { ensureDuckDB } from '@/hooks/useDuckDB'
import type { ColumnSchema } from '@/types/dataset'

export function useDataExplorer() {
  const activeFileId = useFilesStore((s) => s.activeFileId)
  const files = useFilesStore((s) => s.files)
  const activeFile =
    files.find((f) => f.id === activeFileId) ?? (files.length > 0 ? files[files.length - 1]! : null)
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [schema, setSchema] = useState<ColumnSchema[]>([])
  const [loading, setLoading] = useState(false)

  const loadExplorer = useCallback(async () => {
    if (!activeFile) {
      setPreview([])
      setSchema([])
      return
    }

    setLoading(true)
    try {
      await ensureDuckDB()
      const [previewRows, schemaData] = await Promise.all([
        duckdbClient.getPreview(activeFile.tableName, 100),
        duckdbClient.getSchema(activeFile.tableName),
      ])
      setPreview(previewRows)
      setSchema(schemaData.length > 0 ? schemaData : activeFile.schema)
    } catch {
      setPreview([])
      setSchema(activeFile.schema)
    } finally {
      setLoading(false)
    }
  }, [activeFile])

  useEffect(() => {
    void loadExplorer()
  }, [loadExplorer])

  return {
    activeFile,
    preview,
    schema,
    loading,
    refresh: loadExplorer,
  }
}
