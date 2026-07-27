import { create } from 'zustand'
import type { RegisteredDataset } from '@/types/dataset'
import type { TableSchemaDoc } from '@/types/schemaDoc'
import { updatePersistedSchemaDoc } from '@/features/files/services/datasetPersistenceService'

interface FilesState {
  files: RegisteredDataset[]
  activeFileId: string | null
  importStatus: 'idle' | 'loading' | 'error'
  importError: string | null
  /** True while boot restore is running */
  restoringLocal: boolean
  addFile: (file: RegisteredDataset) => void
  setActiveFile: (id: string | null) => void
  setImportStatus: (status: 'idle' | 'loading' | 'error', error?: string) => void
  setRestoringLocal: (restoring: boolean) => void
  setFileSchemaDoc: (fileId: string, schemaDoc: TableSchemaDoc | undefined) => void
  attachSchemaDocByTableName: (schemaDoc: TableSchemaDoc) => string | null
  clearFiles: () => void
  getActiveFile: () => RegisteredDataset | null
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  activeFileId: null,
  importStatus: 'idle',
  importError: null,
  restoringLocal: false,
  addFile: (file) =>
    set((s) => ({
      files: [
        ...s.files.filter((f) => f.id !== file.id && f.tableName !== file.tableName),
        file,
      ],
      activeFileId: file.id,
      importStatus: 'idle',
      importError: null,
    })),
  setActiveFile: (id) => set({ activeFileId: id }),
  setImportStatus: (status, error) => set({ importStatus: status, importError: error ?? null }),
  setRestoringLocal: (restoringLocal) => set({ restoringLocal }),
  setFileSchemaDoc: (fileId, schemaDoc) => {
    set((s) => ({
      files: s.files.map((f) => (f.id === fileId ? { ...f, schemaDoc } : f)),
    }))
    void updatePersistedSchemaDoc(fileId, schemaDoc).catch(() => {
      /* ignore persistence errors for schema docs */
    })
  },
  attachSchemaDocByTableName: (schemaDoc) => {
    const files = get().files
    const target = schemaDoc.table.toLowerCase()
    const match =
      files.find((f) => f.tableName.toLowerCase() === target) ??
      files.find(
        (f) =>
          f.tableName.toLowerCase().includes(target) ||
          target.includes(f.tableName.toLowerCase()),
      )
    if (!match) return null
    const nextDoc = { ...schemaDoc, table: match.tableName }
    set((s) => ({
      files: s.files.map((f) => (f.id === match.id ? { ...f, schemaDoc: nextDoc } : f)),
    }))
    void updatePersistedSchemaDoc(match.id, nextDoc).catch(() => {
      /* ignore */
    })
    return match.tableName
  },
  clearFiles: () =>
    set({
      files: [],
      activeFileId: null,
      importStatus: 'idle',
      importError: null,
    }),
  getActiveFile: () => {
    const { files, activeFileId } = get()
    return files.find((f) => f.id === activeFileId) ?? null
  },
}))
