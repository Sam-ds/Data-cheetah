import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'

interface ModelStatusProps {
  providerLabel: string
  modelLabel: string
  isLocal: boolean
  modelReady: boolean
  loading: boolean
  progressText: string
  progress: number
  remoteKeyReady: boolean
  disabled?: boolean
  onLoad: () => void
  onClear: () => void
  onOpenSettings: () => void
}

export function ModelStatus({
  providerLabel,
  modelLabel,
  isLocal,
  modelReady,
  loading,
  progressText,
  progress,
  remoteKeyReady,
  disabled,
  onLoad,
  onClear,
  onOpenSettings,
}: ModelStatusProps) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Current model
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">{modelLabel}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Provider: <span className="text-foreground">{providerLabel}</span>
            <span className="text-muted-foreground"> · configured in Settings</span>
            {!isLocal && !remoteKeyReady && (
              <span className="text-destructive"> — add OpenRouter API key in Settings</span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {modelReady
              ? 'Loaded for this browser session (kept when you leave Insights).'
              : 'Not in memory yet — load once with the button (not on every refresh).'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-[11px]"
          onClick={onOpenSettings}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Settings
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!modelReady && (
          <Button size="sm" onClick={onLoad} disabled={loading || disabled}>
            {loading ? 'Loading…' : isLocal ? 'Load model' : 'Connect'}
          </Button>
        )}
        {modelReady && !loading && (
          <>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Ready
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onClear}
              disabled={disabled}
              title="Unload from GPU / memory to free RAM"
            >
              Clear from memory
            </Button>
          </>
        )}
        {modelReady && loading && (
          <Button size="sm" disabled>
            Loading…
          </Button>
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
