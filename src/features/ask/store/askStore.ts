import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_ASK_MODEL_ID } from '../config/modelCatalog'
import type { AskPhase, InsightReport, SqlAskReply } from '../llm/types'

interface AskState {
  selectedModelId: string
  modelReady: boolean
  loadProgressText: string
  loadProgress: number
  phase: AskPhase
  /** epoch ms when current busy phase started */
  busyStartedAt: number | null
  /** live stream preview while model writes */
  streamPreview: string
  error: string | null
  /** Dataset ids in scope for Ask + Generate insights */
  selectedFileIds: string[]
  insightReport: InsightReport | null
  sqlAskReply: SqlAskReply | null
  setSelectedModelId: (id: string) => void
  setModelReady: (ready: boolean) => void
  setLoadProgress: (text: string, progress: number) => void
  setPhase: (phase: AskPhase) => void
  setBusyStartedAt: (at: number | null) => void
  setStreamPreview: (text: string) => void
  setError: (error: string | null) => void
  setSelectedFileIds: (ids: string[]) => void
  toggleFileId: (id: string) => void
  setInsightReport: (report: InsightReport | null) => void
  setSqlAskReply: (reply: SqlAskReply | null) => void
  /** Clear Insights/Ask UI without unloading the model from memory. */
  clearInsightUi: () => void
  resetSession: () => void
}

export const useAskStore = create<AskState>()(
  persist(
    (set) => ({
      selectedModelId: DEFAULT_ASK_MODEL_ID,
      modelReady: false,
      loadProgressText: '',
      loadProgress: 0,
      phase: 'idle',
      busyStartedAt: null,
      streamPreview: '',
      error: null,
      selectedFileIds: [],
      insightReport: null,
      sqlAskReply: null,
      setSelectedModelId: (id) => set({ selectedModelId: id, modelReady: false }),
      setModelReady: (ready) => set({ modelReady: ready }),
      setLoadProgress: (text, progress) => set({ loadProgressText: text, loadProgress: progress }),
      setPhase: (phase) => set({ phase }),
      setBusyStartedAt: (at) => set({ busyStartedAt: at }),
      setStreamPreview: (text) => set({ streamPreview: text }),
      setError: (error) =>
        set({
          error,
          ...(error ? { phase: 'error' as const } : {}),
        }),
      setSelectedFileIds: (ids) => set({ selectedFileIds: ids }),
      toggleFileId: (id) =>
        set((s) => ({
          selectedFileIds: s.selectedFileIds.includes(id)
            ? s.selectedFileIds.filter((x) => x !== id)
            : [...s.selectedFileIds, id],
        })),
      setInsightReport: (report) => set({ insightReport: report }),
      setSqlAskReply: (reply) => set({ sqlAskReply: reply }),
      clearInsightUi: () =>
        set({
          insightReport: null,
          sqlAskReply: null,
          streamPreview: '',
          error: null,
          phase: 'idle',
          busyStartedAt: null,
          loadProgressText: '',
          loadProgress: 0,
        }),
      resetSession: () =>
        set({
          modelReady: false,
          loadProgressText: '',
          loadProgress: 0,
          phase: 'idle',
          busyStartedAt: null,
          streamPreview: '',
          error: null,
          selectedFileIds: [],
          insightReport: null,
          sqlAskReply: null,
        }),
    }),
    {
      name: 'datacheetah-ask',
      partialize: (s) => ({ selectedModelId: s.selectedModelId }),
    },
  ),
)
