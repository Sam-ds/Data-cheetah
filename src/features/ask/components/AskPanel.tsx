import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Maximize2, Minimize2, Shield, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAsk } from '../hooks/useAsk'
import { ModelPicker } from './ModelPicker'
import { FilePicker } from './FilePicker'
import { QuestionList } from './QuestionList'
import { AnswerCard } from './AnswerCard'
import { CustomQuestionBox } from './CustomQuestionBox'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'

export function AskPanel() {
  const ask = useAsk()
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const [fullscreen, setFullscreen] = useState(false)
  const modelGateOk = ask.isLocal ? ask.webGpu.ok : ask.vaultUnlocked
  const busy =
    ask.phase === 'loadingModel' ||
    ask.phase === 'generatingQuestions' ||
    ask.phase === 'answering'
  const activeAnswer = ask.activeQuestionId ? ask.answers[ask.activeQuestionId] ?? null : null
  const generating = ask.phase === 'generatingQuestions'
  const answering = ask.phase === 'answering'

  useEffect(() => {
    if (ask.selectedFileIds.length === 0 && ask.files.length > 0) {
      ask.setSelectedFileIds(ask.files.map((f) => f.id))
    }
  }, [ask.files, ask.selectedFileIds.length, ask.setSelectedFileIds])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const statusBanner = busy && (
    <div
      className="border-b border-[#f2a01f]/40 bg-[rgba(242,160,31,0.14)] px-3 py-2.5 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#f2a01f]" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-xs font-semibold text-foreground">
              {ask.phase === 'loadingModel'
                ? 'Loading model'
                : generating
                  ? 'Generating sample insights'
                  : 'Answering'}
            </p>
            {ask.elapsedLabel && (
              <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-[#b45309] dark:text-[#f2a01f]">
                Elapsed {ask.elapsedLabel}
              </span>
            )}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {ask.loadProgressText ||
              (generating
                ? 'Local model is thinking — this can take 30–90+ seconds on CPU/GPU.'
                : answering
                  ? 'Writing SQL, running DuckDB, then summarizing…'
                  : 'Working…')}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full bg-[#f2a01f] ${
                generating || answering ? 'animate-pulse' : 'transition-all duration-300'
              }`}
              style={{
                width:
                  ask.phase === 'loadingModel' && ask.loadProgress > 0
                    ? `${Math.min(100, Math.round(ask.loadProgress * 100))}%`
                    : generating || answering
                      ? '70%'
                      : '35%',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )

  const setupBlock = (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f2a01f]" />
        <span>
          {ask.isLocal
            ? 'Local WebLLM on WebGPU. Schema and sample rows stay on this device.'
            : 'Remote model — questions and schema samples are sent to the selected API. Keys stay encrypted in your vault until unlock.'}
        </span>
      </div>

      {ask.isLocal && !ask.webGpu.ok && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
          {ask.webGpu.reason}
        </p>
      )}

      {ask.error && ask.phase === 'error' && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
          {ask.error}
        </p>
      )}

      <ModelPicker
        askProvider={ask.askProvider}
        selectedModelId={ask.selectedModelId}
        askRemoteModelId={ask.askRemoteModelId}
        modelReady={ask.modelReady}
        loading={ask.phase === 'loadingModel'}
        progressText={ask.loadProgressText}
        progress={ask.loadProgress}
        vaultUnlocked={ask.vaultUnlocked}
        disabled={(ask.isLocal && !ask.webGpu.ok) || busy}
        onSelectLocal={ask.setSelectedModelId}
        onSelectRemote={ask.setAskRemoteModelId}
        onLoad={ask.loadModel}
        onOpenSettings={() => setAppMode('settings')}
      />

      <FilePicker
        files={ask.files}
        selectedFileIds={ask.selectedFileIds}
        onToggle={ask.toggleFileId}
        onAttachSchemaDocs={ask.attachSchemaDocs}
        onClearAllSchemaDocs={ask.clearAllSchemaDocs}
        disabled={busy}
      />

      <CustomQuestionBox
        disabled={!modelGateOk || !ask.modelReady || ask.selectedFileIds.length === 0}
        busy={busy}
        onAsk={ask.runCustomQuestion}
      />

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={busy || !ask.modelReady || ask.selectedFileIds.length === 0}
        onClick={ask.runGenerateQuestions}
      >
        {generating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {generating
          ? `Sample insights… ${ask.elapsedLabel || '0s'}`
          : 'Sample insights'}
      </Button>

      {(generating || answering) && (
        <div className="rounded-xl border border-[#f2a01f]/40 bg-[rgba(242,160,31,0.08)] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-[#f2a01f]" />
            {generating ? 'Generating sample insights' : 'Running insight'}
            {ask.elapsedLabel ? ` · ${ask.elapsedLabel}` : ''}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {generating
              ? 'Up to 5 sample insights. Live text below updates as tokens stream.'
              : 'Steps: write SQL → run in DuckDB → summarize results.'}
          </p>
          {ask.streamPreview && (
            <pre className="mt-2 max-h-28 overflow-auto rounded-md bg-background/80 p-2 text-[10px] leading-snug text-muted-foreground">
              {ask.streamPreview}
              <span className="animate-pulse">▋</span>
            </pre>
          )}
        </div>
      )}
    </div>
  )

  const insightsBlock = (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sample insights
      </p>
      <QuestionList
        questions={ask.questions}
        activeQuestionId={ask.activeQuestionId}
        answering={answering}
        generating={generating}
        onSelect={ask.runAnswer}
      />
    </div>
  )

  const answerBlock = (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Answer
      </p>
      <AnswerCard answer={activeAnswer} />
    </div>
  )

  const panelBody = (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {!fullscreen && (
        <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border/40 px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
            onClick={() => setFullscreen(true)}
            title="Open Ask in full screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Full screen
          </Button>
        </div>
      )}
      {statusBanner}
      <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${busy && !fullscreen ? 'pt-2' : ''}`}>
        {fullscreen ? (
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="space-y-4">
              {setupBlock}
              {insightsBlock}
            </div>
            <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">{answerBlock}</div>
          </div>
        ) : (
          <div className="space-y-4">
            {setupBlock}
            {insightsBlock}
            {answerBlock}
          </div>
        )}
      </div>
    </div>
  )

  const fullscreenOverlay =
    fullscreen &&
    createPortal(
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Sparkles className="h-4 w-4 text-[#f2a01f]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Ask</p>
            <p className="text-[11px] text-muted-foreground">Sample insights · Esc to exit</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setFullscreen(false)}
            title="Exit full screen (Esc)"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Exit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setFullscreen(false)}
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{panelBody}</div>
      </div>,
      document.body,
    )

  return (
    <>
      {fullscreen ? (
        <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
          Ask is open in full screen.
          <Button
            type="button"
            variant="link"
            className="h-auto px-1 text-xs"
            onClick={() => setFullscreen(false)}
          >
            Bring it back
          </Button>
        </div>
      ) : (
        panelBody
      )}
      {fullscreenOverlay}
    </>
  )
}
