import { useCallback, useEffect } from 'react'
import { useFilesStore } from '@/features/files/store/filesStore'
import { duckdbClient } from '@/services/duckdbClient'
import { useState } from 'react'
import type { ColumnSchema } from '@/types/dataset'

export function useDataExplorer() {
  const activeFile = useFilesStore((s) => s.getActiveFile())
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
    loadExplorer()
  }, [loadExplorer])

  return {
    activeFile,
    preview,
    schema,
    loading,
    refresh: loadExplorer,
  }
}
