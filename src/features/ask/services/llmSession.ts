import type { LlmProvider } from '../llm/types'
import { createAskLlmProvider as createLocalAskProvider } from '../llm/webLlmProvider'
import {
  createAnthropicProvider,
  createGeminiProvider,
  createOpenAiCompatibleProvider,
} from '../llm/remoteProviders'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { getUnlockedSecrets, isVaultUnlocked } from '@/features/settings/services/secretsVault'
import type { AskProviderId } from '@/types/askSettings'
import { DEFAULT_ASK_MODEL_ID } from '../config/modelCatalog'
import { useAskStore } from '../store/askStore'

/** Process-wide provider singleton for the Ask feature. */
let provider: LlmProvider | null = null
let providerFingerprint: string | null = null

function fingerprint(providerId: AskProviderId, modelId: string): string {
  return `${providerId}::${modelId}`
}

function requireSecret(
  pick: (s: NonNullable<ReturnType<typeof getUnlockedSecrets>>) => string | undefined,
): string | undefined {
  if (!isVaultUnlocked()) return undefined
  const secrets = getUnlockedSecrets()
  if (!secrets) return undefined
  const v = pick(secrets)?.trim()
  return v || undefined
}

function buildProvider(askProvider: AskProviderId): LlmProvider {
  switch (askProvider) {
    case 'openai':
      return createOpenAiCompatibleProvider({
        id: 'openai',
        getApiKey: () => requireSecret((s) => s.openaiApiKey),
        getBaseUrl: () => 'https://api.openai.com/v1',
        getModelId: () => usePreferencesStore.getState().askRemoteModelId,
      })
    case 'kimi':
      return createOpenAiCompatibleProvider({
        id: 'kimi',
        getApiKey: () => requireSecret((s) => s.kimiApiKey),
        getBaseUrl: () => 'https://api.moonshot.cn/v1',
        getModelId: () => usePreferencesStore.getState().askRemoteModelId,
      })
    case 'openai-compatible':
      return createOpenAiCompatibleProvider({
        id: 'openai-compatible',
        getApiKey: () => requireSecret((s) => s.openaiCompatibleApiKey),
        getBaseUrl: () => {
          const url = getUnlockedSecrets()?.openaiCompatibleBaseUrl?.trim()
          return url || 'https://api.openai.com/v1'
        },
        getModelId: () => usePreferencesStore.getState().askRemoteModelId,
      })
    case 'anthropic':
      return createAnthropicProvider({
        getApiKey: () => requireSecret((s) => s.anthropicApiKey),
        getModelId: () => usePreferencesStore.getState().askRemoteModelId,
      })
    case 'gemini':
      return createGeminiProvider({
        getApiKey: () => requireSecret((s) => s.geminiApiKey),
        getModelId: () => usePreferencesStore.getState().askRemoteModelId,
      })
    case 'local':
    default:
      return createLocalAskProvider()
  }
}

export function getAskLlmProvider(): LlmProvider {
  const askProvider = usePreferencesStore.getState().askProvider
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

/** After goHome / hard reset / provider switch, allow a fresh provider instance. */
export async function resetAskLlmSession(): Promise<void> {
  await unloadAskLlm()
  provider = null
  providerFingerprint = null
}

export function getActiveAskModelId(): string {
  const askProvider = usePreferencesStore.getState().askProvider
  if (askProvider === 'local') {
    return useAskStore.getState().selectedModelId || DEFAULT_ASK_MODEL_ID
  }
  return usePreferencesStore.getState().askRemoteModelId
}
