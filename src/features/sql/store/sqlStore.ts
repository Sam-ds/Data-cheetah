import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QueryResult, SqlDiagnostic } from '@/types/query'

interface SqlState {
  editorContent: string
  diagnostics: SqlDiagnostic[]
  isRunning: boolean
  setEditorContent: (content: string) => void
  setDiagnostics: (diagnostics: SqlDiagnostic[]) => void
  setIsRunning: (running: boolean) => void
}

interface QueryState {
  result: QueryResult | null
  error: string | null
  setResult: (result: QueryResult | null) => void
  setError: (error: string | null) => void
}

export const DEFAULT_SQL = '-- Drop a file and write SQL here\n-- Press Ctrl+Enter to run\n'

export const useSqlStore = create<SqlState>()(
  persist(
    (set) => ({
      editorContent: DEFAULT_SQL,
      diagnostics: [],
      isRunning: false,
      setEditorContent: (content) => set({ editorContent: content }),
      setDiagnostics: (diagnostics) => set({ diagnostics }),
      setIsRunning: (running) => set({ isRunning: running }),
    }),
    // Do not persist SQL — DuckDB tables are in-memory and gone after refresh.
    { name: 'datacheetah-sql', partialize: () => ({}) },
  ),
)

export const useQueryStore = create<QueryState>((set) => ({
  result: null,
  error: null,
  setResult: (result) => set({ result, error: null }),
  setError: (error) => set({ error, result: null }),
}))
