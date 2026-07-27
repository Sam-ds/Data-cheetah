export type AskProviderId =
  | 'local'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'kimi'
  | 'openai-compatible'

export const ASK_PROVIDER_LABELS: Record<AskProviderId, string> = {
  local: 'Local (WebLLM)',
  openai: 'OpenAI',
  anthropic: 'Claude (Anthropic)',
  gemini: 'Google Gemini',
  kimi: 'Kimi (Moonshot)',
  'openai-compatible': 'OpenAI-compatible',
}

export interface RemoteModelEntry {
  id: string
  label: string
  description?: string
}

export const OPENAI_MODELS: RemoteModelEntry[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', description: 'Fast and affordable' },
  { id: 'gpt-4o', label: 'GPT-4o', description: 'Stronger reasoning' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', description: 'Newer mini model' },
]

export const ANTHROPIC_MODELS: RemoteModelEntry[] = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', description: 'Balanced' },
  { id: 'claude-haiku-4-20250414', label: 'Claude Haiku 4', description: 'Fast' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', description: 'Highest quality' },
]

export const GEMINI_MODELS: RemoteModelEntry[] = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Fast multimodal' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Newer flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Higher quality' },
]

export const KIMI_MODELS: RemoteModelEntry[] = [
  { id: 'moonshot-v1-8k', label: 'Moonshot v1 8K' },
  { id: 'moonshot-v1-32k', label: 'Moonshot v1 32K' },
  { id: 'moonshot-v1-128k', label: 'Moonshot v1 128K' },
]

export function defaultRemoteModelFor(provider: AskProviderId): string {
  switch (provider) {
    case 'openai':
      return OPENAI_MODELS[0].id
    case 'anthropic':
      return ANTHROPIC_MODELS[0].id
    case 'gemini':
      return GEMINI_MODELS[0].id
    case 'kimi':
      return KIMI_MODELS[0].id
    case 'openai-compatible':
      return 'gpt-4o-mini'
    default:
      return OPENAI_MODELS[0].id
  }
}

export function modelsForProvider(provider: AskProviderId): RemoteModelEntry[] {
  switch (provider) {
    case 'openai':
      return OPENAI_MODELS
    case 'anthropic':
      return ANTHROPIC_MODELS
    case 'gemini':
      return GEMINI_MODELS
    case 'kimi':
      return KIMI_MODELS
    default:
      return []
  }
}

/** Plaintext secrets — only held in memory after vault unlock; encrypted at rest. */
export interface AskSecretsPayload {
  openaiApiKey?: string
  anthropicApiKey?: string
  geminiApiKey?: string
  kimiApiKey?: string
  openaiCompatibleApiKey?: string
  /** e.g. https://api.openai.com/v1 or OpenRouter / Azure-compatible base */
  openaiCompatibleBaseUrl?: string
}

export const EMPTY_ASK_SECRETS: AskSecretsPayload = {}
