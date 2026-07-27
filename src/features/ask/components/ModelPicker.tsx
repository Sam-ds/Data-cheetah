import { ASK_MODEL_CATALOG } from '../config/modelCatalog'
import { Button } from '@/components/ui/button'
import {
  ASK_PROVIDER_LABELS,
  modelsForProvider,
  type AskProviderId,
} from '@/types/askSettings'

interface ModelPickerProps {
  askProvider: AskProviderId
  selectedModelId: string
  askRemoteModelId: string
  modelReady: boolean
  loading: boolean
  progressText: string
  progress: number
  vaultUnlocked: boolean
  disabled?: boolean
  onSelectLocal: (id: string) => void
  onSelectRemote: (id: string) => void
  onLoad: () => void
  onOpenSettings?: () => void
}

export function ModelPicker({
  askProvider,
  selectedModelId,
  askRemoteModelId,
  modelReady,
  loading,
  progressText,
  progress,
  vaultUnlocked,
  disabled,
  onSelectLocal,
  onSelectRemote,
  onLoad,
  onOpenSettings,
}: ModelPickerProps) {
  const isLocal = askProvider === 'local'
  const remoteModels = modelsForProvider(askProvider)
  const entry = isLocal
    ? ASK_MODEL_CATALOG.find((m) => m.id === selectedModelId)
    : remoteModels.find((m) => m.id === askRemoteModelId)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Model
        </label>
        <button
          type="button"
          className="text-[10px] font-medium text-[#b45309] hover:underline dark:text-[#f2a01f]"
          onClick={onOpenSettings}
        >
          Settings
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Provider:{' '}
        <span className="font-medium text-foreground">{ASK_PROVIDER_LABELS[askProvider]}</span>
        {!isLocal && !vaultUnlocked && (
          <span className="text-destructive"> — unlock API vault in Settings</span>
        )}
      </p>

      {isLocal ? (
        <select
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          value={selectedModelId}
          disabled={loading || disabled}
          onChange={(e) => onSelectLocal(e.target.value)}
        >
          {ASK_MODEL_CATALOG.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.sizeHint})
            </option>
          ))}
        </select>
      ) : askProvider === 'openai-compatible' ? (
        <input
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          value={askRemoteModelId}
          disabled={loading || disabled}
          onChange={(e) => onSelectRemote(e.target.value)}
          placeholder="model id"
        />
      ) : (
        <select
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          value={askRemoteModelId}
          disabled={loading || disabled}
          onChange={(e) => onSelectRemote(e.target.value)}
        >
          {remoteModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      )}

      {entry?.description && (
        <p className="text-[11px] text-muted-foreground">{entry.description}</p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onLoad} disabled={loading || disabled}>
          {loading
            ? 'Loading…'
            : modelReady
              ? isLocal
                ? 'Reload model'
                : 'Reconnect'
              : isLocal
                ? 'Load model'
                : 'Connect'}
        </Button>
        {modelReady && !loading && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Ready</span>
        )}
      </div>
      {loading && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[#f2a01f] transition-all"
              style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
            />
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{progressText}</p>
        </div>
      )}
    </div>
  )
}
