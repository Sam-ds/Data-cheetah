export type AskProviderId = 'local' | 'openrouter'

export const ASK_PROVIDER_LABELS: Record<AskProviderId, string> = {
  local: 'Local (WebLLM)',
  openrouter: 'OpenRouter',
}

/** Map legacy multi-provider ids (and unknown) onto the current set. */
export function coerceAskProvider(id: unknown): AskProviderId {
  if (id === 'local') return 'local'
  if (id === 'openrouter') return 'openrouter'
  if (typeof id === 'string' && id.length > 0) return 'openrouter'
  return 'local'
}

export function defaultRemoteModelFor(provider: AskProviderId): string {
  if (provider === 'openrouter') return 'openai/gpt-4o'
  return 'openai/gpt-4o'
}

/** @deprecated kept empty for any leftover imports */
export function modelsForProvider(_provider: AskProviderId): { id: string; label: string }[] {
  return []
}
