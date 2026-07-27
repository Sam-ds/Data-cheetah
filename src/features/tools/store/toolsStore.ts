import { create } from 'zustand'

export type ToolId = 'json-format' | 'json-minify' | 'json-compare' | 'text-compare'

interface ToolsState {
  open: boolean
  activeToolId: ToolId
  openTool: (id: ToolId) => void
  setActiveToolId: (id: ToolId) => void
  close: () => void
}

export const TOOL_LABELS: Record<ToolId, string> = {
  'json-format': 'JSON Formatter',
  'json-minify': 'JSON Minifier',
  'json-compare': 'JSON Compare',
  'text-compare': 'Text Compare',
}

export const useToolsStore = create<ToolsState>((set) => ({
  open: false,
  activeToolId: 'json-format',
  openTool: (id) => set({ open: true, activeToolId: id }),
  setActiveToolId: (id) => set({ activeToolId: id }),
  close: () => set({ open: false }),
}))
