import { useEffect, useState } from 'react'
import { ArrowLeft, Database, FlaskConical, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DUCKDB_MEMORY_OPTIONS,
  type DuckDbMemoryLimit,
} from '@/types/preferences'
import {
  ASK_PROVIDER_LABELS,
  type AskProviderId,
  defaultRemoteModelFor,
} from '@/types/askSettings'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import {
  clearOpenRouterApiKey,
  savePreferences,
} from '@/services/storageService'
import { testOpenRouterApiKey } from '@/features/settings/services/testApiKey'
import { resetDuckDB, ensureDuckDB } from '@/hooks/useDuckDB'
import { rehydratePersistedFiles } from '@/features/files/services/localDatasetService'
import { resetAskLlmSession, unloadAskLlm, useAskStore, ASK_MODEL_CATALOG } from '@/features/ask'
import { toast } from 'sonner'
import { PageStage } from '@/features/workspace/components/PageStage'
import { goHome } from '@/features/workspace/goHome'

const PROVIDERS: AskProviderId[] = ['local', 'openrouter']

export function SettingsPage() {
  const duckdbMemoryLimit = usePreferencesStore((s) => s.duckdbMemoryLimit)
  const setDuckdbMemoryLimit = usePreferencesStore((s) => s.setDuckdbMemoryLimit)
  const askProvider = usePreferencesStore((s) => s.askProvider)
  const setAskProvider = usePreferencesStore((s) => s.setAskProvider)
  const askRemoteModelId = usePreferencesStore((s) => s.askRemoteModelId)
  const setAskRemoteModelId = usePreferencesStore((s) => s.setAskRemoteModelId)
  const openrouterApiKey = usePreferencesStore((s) => s.openrouterApiKey)
  const setOpenrouterApiKey = usePreferencesStore((s) => s.setOpenrouterApiKey)
  const selectedLocalModelId = useAskStore((s) => s.selectedModelId)
  const modelReady = useAskStore((s) => s.modelReady)
  const setModelReady = useAskStore((s) => s.setModelReady)

  const hasSavedKey = Boolean(openrouterApiKey?.trim())
  const [draftKey, setDraftKey] = useState('')
  const [draftModel, setDraftModel] = useState(askRemoteModelId)
  const [restarting, setRestarting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [clearingKey, setClearingKey] = useState(false)

  useEffect(() => {
    // Keep the full key out of the input after hydrate — mask via placeholder.
    setDraftKey('')
  }, [openrouterApiKey])

  useEffect(() => {
    setDraftModel(askRemoteModelId)
  }, [askRemoteModelId])

  const persistAskPrefs = async (patch: {
    askProvider?: AskProviderId
    askRemoteModelId?: string
    openrouterApiKey?: string
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
    if (id !== 'local') {
      setAskRemoteModelId(remote)
      setDraftModel(remote)
    }
    await persistAskPrefs({
      askProvider: id,
      askRemoteModelId: id === 'local' ? askRemoteModelId : remote,
    })
    await resetAskLlmSession()
    setModelReady(false)
    toast.success(`Ask provider: ${ASK_PROVIDER_LABELS[id]}`)
  }

  const onLocalModelChange = async (id: string) => {
    useAskStore.getState().setSelectedModelId(id)
    await resetAskLlmSession()
    setModelReady(false)
    toast.success('Local model updated — open Insights and Load model once')
  }

  const saveOpenRouter = async () => {
    const typed = draftKey.trim()
    const model = draftModel.trim() || defaultRemoteModelFor('openrouter')
    const key = typed || openrouterApiKey.trim()
    if (!key) {
      toast.error('Paste an OpenRouter API key to save')
      return
    }
    setOpenrouterApiKey(key)
    setAskRemoteModelId(model)
    setDraftModel(model)
    setDraftKey('')
    await persistAskPrefs({ openrouterApiKey: key, askRemoteModelId: model })
    await resetAskLlmSession()
    setModelReady(false)
    toast.success('OpenRouter settings saved on this device')
  }

  const clearKey = async () => {
    setClearingKey(true)
    try {
      await clearOpenRouterApiKey()
      setOpenrouterApiKey('')
      setDraftKey('')
      await resetAskLlmSession()
      setModelReady(false)
      toast.success('OpenRouter API key cleared from this browser')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not clear API key')
    } finally {
      setClearingKey(false)
    }
  }

  const clearModelFromMemory = async () => {
    await unloadAskLlm()
    await resetAskLlmSession()
    setModelReady(false)
    toast.success('Model cleared from memory')
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const key = draftKey.trim() || openrouterApiKey.trim()
      const result = await testOpenRouterApiKey(key, draftModel)
      if (result.ok) toast.success(result.detail)
      else toast.error(result.detail)
    } finally {
      setTesting(false)
    }
  }

  return (
    <PageStage enterKey="settings" contentClassName="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 px-6 py-8 pb-16">
      <div>
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-1.5" onClick={goHome}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <span className="page-eyebrow">On-device preferences</span>
        <h1 className="page-title mt-3">Settings</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          DuckDB memory, Insights provider (local or OpenRouter), and on-device preferences.
        </p>
      </div>

      <div className="page-stagger flex flex-col gap-6">
      <section className="page-panel space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="page-heading-icon"><Database className="h-4 w-4" /></span>
          DuckDB engine memory
        </div>
        <select
          className="page-field"
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
          Restart to apply a change to an already-running session.
        </p>
        <Button size="sm" variant="outline" disabled={restarting} onClick={() => void restartEngine()}>
          {restarting ? 'Restarting…' : 'Restart engine & reload datasets'}
        </Button>
      </section>

      <section className="page-panel space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="page-heading-icon"><Sparkles className="h-4 w-4" /></span>
          Insights / Ask provider
        </div>
        <p className="text-[11px] text-muted-foreground">
          Local needs WebGPU and no API key. OpenRouter uses one key for many models — enter the model
          id yourself (for example <code className="text-foreground">openai/gpt-4o</code>).
        </p>
        <select
          className="page-field"
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
              className="page-field"
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
              Choice is saved. In Insights, click <strong>Load model</strong> once per browser session.
            </p>
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
                Clear model from memory
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {modelReady ? 'Currently loaded this session' : 'Not loaded'}
              </span>
            </div>
          </>
        ) : (
          <>
            <label className="block text-xs text-muted-foreground">OpenRouter API key</label>
            <input
              type="password"
              autoComplete="off"
              className="page-field"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder={hasSavedKey ? '•••• saved on this device' : 'sk-or-…'}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Your key is stored locally in your browser and sent directly to OpenRouter. We never see
              or store your key.
            </p>
            <label className="block text-xs text-muted-foreground">Model id</label>
            <input
              className="page-field"
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
              placeholder="openai/gpt-4o"
            />
            <p className="text-[11px] text-muted-foreground">
              Key stays in this browser&apos;s IndexedDB only (not synced). Get a key at{' '}
              <a
                className="brand-link underline underline-offset-2"
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
              >
                openrouter.ai/keys
              </a>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void saveOpenRouter()}>
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={testing || (!draftKey.trim() && !hasSavedKey)}
                onClick={() => void handleTest()}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {testing ? 'Testing…' : 'Test key'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={!hasSavedKey || clearingKey}
                onClick={() => void clearKey()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {clearingKey ? 'Clearing…' : 'Clear Key'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!modelReady}
                onClick={() => void clearModelFromMemory()}
              >
                Clear connection
              </Button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {modelReady ? 'Connected this session' : 'Not connected — open Insights → Connect'}
            </span>
          </>
        )}
      </section>

      <Separator />
      <p className="text-[11px] text-muted-foreground">
        Changes apply to Insights, the Ask bar, and optional LLM seeding in Generate Data.
      </p>
      </div>
    </PageStage>
  )
}
