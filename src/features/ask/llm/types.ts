export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface LoadProgress {
  text: string
  progress: number
}

/** Pluggable local LLM — UI never imports WebLLM directly. */
export interface LlmProvider {
  id: string
  load(modelId: string, onProgress?: (p: LoadProgress) => void): Promise<void>
  unload(): Promise<void>
  isReady(): boolean
  complete(
    messages: ChatMessage[],
    opts?: { temperature?: number; onChunk?: (accumulated: string) => void },
  ): Promise<string>
}

export interface AskQuestion {
  id: string
  question: string
  rationale?: string
}

export interface AskQueryStep {
  goal: string
  sql: string
  columns: string[]
  previewRows: Record<string, unknown>[]
  rowCount: number
  error?: string
}

export interface AskAnswer {
  questionId: string
  sql: string
  answer: string
  rowCount: number
  previewRows: Record<string, unknown>[]
  columns: string[]
  /** Multi-step Ask plan evidence */
  steps?: AskQueryStep[]
  /** Query returned no rows / only nulls — answer is not model-generated */
  emptyResult?: boolean
  error?: string
}

/** One evidence item behind the final insights summary. */
export interface InsightFinding {
  id: string
  title: string
  sql: string
  answer: string
  rowCount: number
  previewRows: Record<string, unknown>[]
  columns: string[]
  emptyResult?: boolean
  error?: string
}

export interface InsightReport {
  summary: string
  findings: InsightFinding[]
  generatedAt: number
}

export type AskPhase =
  | 'idle'
  | 'loadingModel'
  | 'generatingInsights'
  | 'answering'
  | 'error'

/** Latest ad-hoc question answered from the SQL ask bar. */
export interface SqlAskReply {
  question: string
  answer: string
  sql: string
  steps?: AskQueryStep[]
  error?: string
}
