import { create } from 'zustand'
import type { RegisteredDataset } from '@/types/dataset'

interface FilesState {
  files: RegisteredDataset[]
  activeFileId: string | null
  importStatus: 'idle' | 'loading' | 'error'
  importError: string | null
  addFile: (file: RegisteredDataset) => void
  setActiveFile: (id: string | null) => void
  setImportStatus: (status: 'idle' | 'loading' | 'error', error?: string) => void
  getActiveFile: () => RegisteredDataset | null
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  activeFileId: null,
  importStatus: 'idle',
  importError: null,
  addFile: (file) =>
    set((s) => ({
      files: [...s.files.filter((f) => f.id !== file.id), file],
      activeFileId: file.id,
      importStatus: 'idle',
      importError: null,
    })),
  setActiveFile: (id) => set({ activeFileId: id }),
  setImportStatus: (status, error) => set({ importStatus: status, importError: error ?? null }),
  getActiveFile: () => {
    const { files, activeFileId } = get()
    return files.find((f) => f.id === activeFileId) ?? null
  },
}))
