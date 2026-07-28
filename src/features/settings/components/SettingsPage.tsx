import { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, Lock, Shield, Database, Sparkles, Trash2, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DUCKDB_MEMORY_OPTIONS,
  type DuckDbMemoryLimit,
} from '@/types/preferences'
import {
  ASK_PROVIDER_LABELS,
  type AskProviderId,
  type AskSecretsPayload,
  EMPTY_ASK_SECRETS,
  modelsForProvider,
  defaultRemoteModelFor,
} from '@/types/askSettings'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { savePreferences } from '@/services/storageService'
import {
  createVault,
  destroyVault,
  getUnlockedSecrets,
  isVaultUnlocked,
  lockVault,
  saveUnlockedSecrets,
  unlockVault,
  vaultExists,
} from '@/features/settings/services/secretsVault'
import {
  testProviderApiKey,
  type TestableProvider,
} from '@/features/settings/services/testApiKey'
import { resetDuckDB, ensureDuckDB } from '@/hooks/useDuckDB'
import { rehydratePersistedFiles } from '@/features/files/services/localDatasetService'
import { resetAskLlmSession, unloadAskLlm, useAskStore, ASK_MODEL_CATALOG } from '@/features/ask'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

const PROVIDERS: AskProviderId[] = [
  'local',
  'openai',
  'anthropic',
  'gemini',
  'kimi',
  'openai-compatible',
]

type SecretKeyField =
  | 'openaiApiKey'
  | 'anthropicApiKey'
  | 'geminiApiKey'
  | 'kimiApiKey'
  | 'openaiCompatibleApiKey'

const KEY_ROWS: {
  provider: TestableProvider
  field: SecretKeyField
  label: string
  hint: string
}[] = [
  {
    provider: 'openai',
    field: 'openaiApiKey',
    label: 'OpenAI',
    hint: 'Used when Ask provider = OpenAI (all OpenAI models share this key)',
  },
  {
    provider: 'anthropic',
    field: 'anthropicApiKey',
    label: 'Claude (Anthropic)',
    hint: 'Used when Ask provider = Claude — one key for Sonnet / Haiku / Opus',
  },
  {
    provider: 'gemini',
    field: 'geminiApiKey',
    label: 'Google Gemini',
    hint: 'Used when Ask provider = Gemini',
  },
  {
    provider: 'kimi',
    field: 'kimiApiKey',
    label: 'Kimi (Moonshot)',
    hint: 'Used when Ask provider = Kimi',
  },
  {
    provider: 'openai-compatible',
    field: 'openaiCompatibleApiKey',
    label: 'OpenAI-compatible',
    hint: 'Custom base URL + key (OpenRouter, Azure OpenAI-compatible, etc.)',
  },
]

export function SettingsPage() {
  const duckdbMemoryLimit = usePreferencesStore((s) => s.duckdbMemoryLimit)
  const setDuckdbMemoryLimit = usePreferencesStore((s) => s.setDuckdbMemoryLimit)
  const askProvider = usePreferencesStore((s) => s.askProvider)
  const setAskProvider = usePreferencesStore((s) => s.setAskProvider)
  const askRemoteModelId = usePreferencesStore((s) => s.askRemoteModelId)
  const setAskRemoteModelId = usePreferencesStore((s) => s.setAskRemoteModelId)
  const selectedLocalModelId = useAskStore((s) => s.selectedModelId)
  const modelReady = useAskStore((s) => s.modelReady)
  const setModelReady = useAskStore((s) => s.setModelReady)

  const [hasVault, setHasVault] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [passphraseConfirm, setPassphraseConfirm] = useState('')
  const [draftSecrets, setDraftSecrets] = useState<AskSecretsPayload>({ ...EMPTY_ASK_SECRETS })
  const [busy, setBusy] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [testing, setTesting] = useState<TestableProvider | null>(null)

  const refreshVaultState = async () => {
    const exists = await vaultExists()
    setHasVault(exists)
    const open = isVaultUnlocked()
    setUnlocked(open)
    if (open) {
      setDraftSecrets(getUnlockedSecrets() ?? { ...EMPTY_ASK_SECRETS })
    }
  }

  useEffect(() => {
    void refreshVaultState()
  }, [])

  const persistAskPrefs = async (patch: {
    askProvider?: AskProviderId
    askRemoteModelId?: string
    duckdbMemoryLimit?: DuckDbMemoryLimit
  }) => {
    await savePreferences(patch)
  }

  const onMemoryChange = async (value: DuckDbMemoryLimit) => {
    setDuckdbMemoryLimit(value)
    await persistAskPrefs({ duckdbMemoryLimit: value })
    toast.message('Memory limit saved — restart the engine to apply')
  }

  const restartEngine = async () => {
    setRestarting(true)
    try {
      await resetDuckDB()
      await ensureDuckDB()
      await rehydratePersistedFiles({ force: true })
      toast.success(`DuckDB restarted with memory_limit=${duckdbMemoryLimit}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restart DuckDB')
    } finally {
      setRestarting(false)
    }
  }

  const onProviderChange = async (id: AskProviderId) => {
    setAskProvider(id)
    const remote = id === 'local' ? askRemoteModelId : defaultRemoteModelFor(id)
    if (id !== 'local') setAskRemoteModelId(remote)
    await persistAskPrefs({
      askProvider: id,
      askRemoteModelId: id === 'local' ? askRemoteModelId : remote,
    })
    await resetAskLlmSession()
    setModelReady(false)
    toast.success(`Ask provider: ${ASK_PROVIDER_LABELS[id]}`)
  }

  const onRemoteModelChange = async (id: string) => {
    setAskRemoteModelId(id)
    await persistAskPrefs({ askRemoteModelId: id })
    await resetAskLlmSession()
    setModelReady(false)
  }

  const onLocalModelChange = async (id: string) => {
    useAskStore.getState().setSelectedModelId(id)
    await resetAskLlmSession()
    setModelReady(false)
    toast.success('Local model updated — open Insights and Load model once')
  }

  const clearModelFromMemory = async () => {
    await unloadAskLlm()
    await resetAskLlmSession()
    setModelReady(false)
    toast.success('Model cleared from memory')
  }

  const handleCreateVault = async () => {
    if (passphrase !== passphraseConfirm) {
      toast.error('Passphrases do not match')
      return
    }
    setBusy(true)
    try {
      await createVault(passphrase)
      setPassphrase('')
      setPassphraseConfirm('')
      await refreshVaultState()
      toast.success('Encrypted vault created — paste API keys below')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create vault')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    setBusy(true)
    try {
      const secrets = await unlockVault(passphrase)
      setDraftSecrets(secrets)
      setPassphrase('')
      setUnlocked(true)
      toast.success('Vault unlocked — you can edit and test keys')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setBusy(false)
    }
  }

  const handleLock = () => {
    lockVault()
    setDraftSecrets({ ...EMPTY_ASK_SECRETS })
    setUnlocked(false)
    void resetAskLlmSession()
    setModelReady(false)
    toast.message('Vault locked — API keys cleared from memory')
  }

  const handleSaveSecrets = async () => {
    setBusy(true)
    try {
      await saveUnlockedSecrets(draftSecrets)
      toast.success('API keys encrypted and saved on this device')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async (provider: TestableProvider) => {
    setTesting(provider)
    try {
      // Persist draft first so test uses what you typed
      if (isVaultUnlocked()) {
        await saveUnlockedSecrets(draftSecrets)
      }
      const result = await testProviderApiKey(provider, draftSecrets, askRemoteModelId)
      if (result.ok) toast.success(result.detail)
      else toast.error(result.detail)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setTesting(null)
    }
  }

  const handleDestroy = async () => {
    const ok = window.confirm(
      'Permanently delete the encrypted vault and all stored API keys from this browser?',
    )
    if (!ok) return
    setBusy(true)
    try {
      await destroyVault()
      setDraftSecrets({ ...EMPTY_ASK_SECRETS })
      setUnlocked(false)
      setHasVault(false)
      await resetAskLlmSession()
      toast.success('Vault destroyed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not destroy vault')
    } finally {
      setBusy(false)
    }
  }

  const remoteModels = modelsForProvider(askProvider)

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick which Insights backend to use, store each provider’s API key in the encrypted vault, then
            unlock the vault when you want Insights to call that API.
          </p>
        </div>

        <section className="space-y-3 rounded-xl border border-border/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="h-4 w-4 text-[#f2a01f]" />
            DuckDB engine
          </div>
          <label className="block text-xs text-muted-foreground">Memory limit</label>
          <select
            className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm"
            value={duckdbMemoryLimit}
            onChange={(e) => void onMemoryChange(e.target.value as DuckDbMemoryLimit)}
          >
            {DUCKDB_MEMORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Applied via <code className="text-[10px]">SET memory_limit</code> when the engine starts.
            Restart to apply a change to an already-running session.
          </p>
          <Button size="sm" variant="outline" disabled={restarting} onClick={() => void restartEngine()}>
            {restarting ? 'Restarting…' : 'Restart engine & reload datasets'}
          </Button>
        </section>

        <section className="space-y-3 rounded-xl border border-border/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-[#f2a01f]" />
            1. Which Insights provider to use
          </div>
          <p className="text-[11px] text-muted-foreground">
            This chooses the active backend for Generate insights. Local needs no key. Remote
            providers use the matching key from the vault below (not a separate key per model name).
          </p>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={askProvider}
            onChange={(e) => void onProviderChange(e.target.value as AskProviderId)}
          >
            {PROVIDERS.map((id) => (
              <option key={id} value={id}>
                {ASK_PROVIDER_LABELS[id]}
              </option>
            ))}
          </select>

          {askProvider === 'local' ? (
            <>
              <label className="block text-xs text-muted-foreground">Local WebLLM model</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={selectedLocalModelId}
                onChange={(e) => void onLocalModelChange(e.target.value)}
              >
                {ASK_MODEL_CATALOG.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.sizeHint})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Choice is saved. Insights only shows this model — click <strong>Load model</strong>{' '}
                once per browser session (not on every refresh). A full page refresh clears GPU
                memory and requires Load again.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!modelReady}
                  onClick={() => void clearModelFromMemory()}
                  title="Unload WebLLM from GPU/RAM"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear model from memory
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {modelReady ? 'Currently loaded this session' : 'Not loaded'}
                </span>
              </div>
            </>
          ) : (
            <>
              {askProvider !== 'openai-compatible' && remoteModels.length > 0 && (
                <>
                  <label className="block text-xs text-muted-foreground">Model for this provider</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={askRemoteModelId}
                    onChange={(e) => void onRemoteModelChange(e.target.value)}
                  >
                    {remoteModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {askProvider === 'openai-compatible' && (
                <>
                  <label className="block text-xs text-muted-foreground">Model id</label>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={askRemoteModelId}
                    onChange={(e) => setAskRemoteModelId(e.target.value)}
                    onBlur={() => void onRemoteModelChange(askRemoteModelId)}
                    placeholder="gpt-4o-mini"
                  />
                </>
              )}
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-[11px] text-muted-foreground">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                Scroll to section 2, unlock the vault, paste the{' '}
                <strong className="text-foreground">{ASK_PROVIDER_LABELS[askProvider]}</strong> key,
                save, then open Insights → Connect once per session.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!modelReady}
                  onClick={() => void clearModelFromMemory()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear connection from memory
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {modelReady ? 'Connected this session' : 'Not connected'}
                </span>
              </div>
            </>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-[#f2a01f]" />
            2. Encrypted API keys (vault)
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">What this is for:</strong> a secure on-device store for
            your provider API keys. You can save keys for several providers; Insights only uses the key that
            matches the provider selected above. Encryption (PBKDF2 + AES-GCM) protects keys at rest —
            it is not itself a model.
          </p>

          {!hasVault && (
            <div className="space-y-2">
              <label className="block text-xs text-muted-foreground">Create vault passphrase</label>
              <input
                type="password"
                autoComplete="new-password"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="At least 8 characters"
              />
              <input
                type="password"
                autoComplete="new-password"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={passphraseConfirm}
                onChange={(e) => setPassphraseConfirm(e.target.value)}
                placeholder="Confirm passphrase"
              />
              <Button size="sm" disabled={busy} onClick={() => void handleCreateVault()}>
                Create encrypted vault
              </Button>
            </div>
          )}

          {hasVault && !unlocked && (
            <div className="space-y-2">
              <label className="block text-xs text-muted-foreground">Unlock passphrase</label>
              <input
                type="password"
                autoComplete="current-password"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleUnlock()
                }}
                placeholder="Vault passphrase"
              />
              <Button size="sm" disabled={busy} onClick={() => void handleUnlock()}>
                <Lock className="h-3.5 w-3.5" />
                Unlock vault
              </Button>
            </div>
          )}

          {hasVault && unlocked && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleLock}>
                  <Lock className="h-3.5 w-3.5" />
                  Lock session
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => void handleDestroy()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Destroy vault
                </Button>
              </div>
              <Separator />

              {KEY_ROWS.map((row) => {
                const active = askProvider === row.provider
                return (
                  <div
                    key={row.field}
                    className={cn(
                      'space-y-2 rounded-lg border p-3',
                      active
                        ? 'border-[#f2a01f]/50 bg-[rgba(242,160,31,0.06)]'
                        : 'border-border/50',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {row.label}
                          {active && (
                            <span className="ml-2 rounded bg-[#f2a01f]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#b45309] dark:text-[#f2a01f]">
                              Active provider
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{row.hint}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[11px]"
                        disabled={busy || testing !== null}
                        onClick={() => void handleTest(row.provider)}
                      >
                        {testing === row.provider ? (
                          'Testing…'
                        ) : (
                          <>
                            <FlaskConical className="h-3 w-3" />
                            Test key
                          </>
                        )}
                      </Button>
                    </div>
                    <input
                      type="password"
                      autoComplete="off"
                      className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm"
                      value={draftSecrets[row.field] ?? ''}
                      onChange={(e) =>
                        setDraftSecrets((s) => ({ ...s, [row.field]: e.target.value }))
                      }
                      placeholder="Paste API key…"
                    />
                    {row.provider === 'openai-compatible' && (
                      <input
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={draftSecrets.openaiCompatibleBaseUrl ?? ''}
                        onChange={(e) =>
                          setDraftSecrets((s) => ({
                            ...s,
                            openaiCompatibleBaseUrl: e.target.value,
                          }))
                        }
                        placeholder="Base URL — https://api.openai.com/v1"
                      />
                    )}
                  </div>
                )
              })}

              <Button size="sm" disabled={busy} onClick={() => void handleSaveSecrets()}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Save encrypted keys
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
