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

export interface AskAnswer {
  questionId: string
  sql: string
  answer: string
  rowCount: number
  previewRows: Record<string, unknown>[]
  columns: string[]
  /** Query returned no rows / only nulls — answer is not model-generated */
  emptyResult?: boolean
  error?: string
}

export type AskPhase =
  | 'idle'
  | 'loadingModel'
  | 'generatingQuestions'
  | 'answering'
  | 'error'
