import type { AskProviderId } from './askSettings'

export type DuckDbMemoryLimit = '512MB' | '1GB' | '2GB' | '4GB'

export interface Preferences {
  id: string
  theme: 'light' | 'dark'
  layout: {
    sidebarSize: number
    bottomSize: number
    rightSize: number
    sidebarCollapsed: boolean
  }
  editorSettings: {
    fontSize: number
    wordWrap: boolean
  }
  defaultRowLimit: number
  /** DuckDB WASM memory_limit (applied on engine init) */
  duckdbMemoryLimit: DuckDbMemoryLimit
  askProvider: AskProviderId
  /** Remote / compatible model id when not using local WebLLM */
  askRemoteModelId: string
  updatedAt: Date
}

export const DUCKDB_MEMORY_OPTIONS: { value: DuckDbMemoryLimit; label: string }[] = [
  { value: '512MB', label: '512 MB' },
  { value: '1GB', label: '1 GB' },
  { value: '2GB', label: '2 GB' },
  { value: '4GB', label: '4 GB' },
]

export const DEFAULT_PREFERENCES: Preferences = {
  id: 'default',
  theme: 'light',
  layout: {
    sidebarSize: 20,
    bottomSize: 40,
    rightSize: 25,
    sidebarCollapsed: false,
  },
  editorSettings: {
    fontSize: 13,
    wordWrap: true,
  },
  defaultRowLimit: 10000,
  duckdbMemoryLimit: '1GB',
  askProvider: 'local',
  askRemoteModelId: 'gpt-4o-mini',
  updatedAt: new Date(),
}
