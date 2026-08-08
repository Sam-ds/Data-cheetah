import type { LlmProvider } from '../llm/types'
import { createAskLlmProvider as createLocalAskProvider } from '../llm/webLlmProvider'
import { createOpenAiCompatibleProvider } from '../llm/remoteProviders'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import type { AskProviderId } from '@/types/askSettings'
import { coerceAskProvider } from '@/types/askSettings'
import { DEFAULT_ASK_MODEL_ID } from '../config/modelCatalog'
import { useAskStore } from '../store/askStore'

/** Process-wide provider singleton for the Ask feature. */
let provider: LlmProvider | null = null
let providerFingerprint: string | null = null

function fingerprint(providerId: AskProviderId, modelId: string): string {
  return `${providerId}::${modelId}`
}

function buildProvider(askProvider: AskProviderId): LlmProvider {
  if (askProvider === 'openrouter') {
    return createOpenAiCompatibleProvider({
      id: 'openrouter',
      getApiKey: () => usePreferencesStore.getState().openrouterApiKey?.trim() || undefined,
      getBaseUrl: () => 'https://openrouter.ai/api/v1',
      getModelId: () => usePreferencesStore.getState().askRemoteModelId || 'openai/gpt-4o',
    })
  }
  return createLocalAskProvider()
}

export function getAskLlmProvider(): LlmProvider {
  const askProvider = coerceAskProvider(usePreferencesStore.getState().askProvider)
  const modelId =
    askProvider === 'local'
      ? useAskStore.getState().selectedModelId || DEFAULT_ASK_MODEL_ID
      : usePreferencesStore.getState().askRemoteModelId
  const fp = fingerprint(askProvider, modelId)
  if (provider && providerFingerprint === fp) return provider
  provider = buildProvider(askProvider)
  providerFingerprint = fp
  return provider
}

export async function unloadAskLlm(): Promise<void> {
  if (provider) {
    await provider.unload()
  }
}

/** After hard reset / provider switch, allow a fresh provider instance. */
export async function resetAskLlmSession(): Promise<void> {
  await unloadAskLlm()
  provider = null
  providerFingerprint = null
}

export function getActiveAskModelId(): string {
  const askProvider = coerceAskProvider(usePreferencesStore.getState().askProvider)
  if (askProvider === 'local') {
    return useAskStore.getState().selectedModelId || DEFAULT_ASK_MODEL_ID
  }
  return usePreferencesStore.getState().askRemoteModelId || 'openai/gpt-4o'
}
