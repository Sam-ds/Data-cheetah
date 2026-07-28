import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useFilesStore } from '@/features/files/store/filesStore'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { useAskStore } from '../store/askStore'
import { buildFileContexts } from '../services/contextBuilder'
import { generateInsightReport } from '../services/insightsService'
import { answerQuestion } from '../services/answerService'
import {
  getActiveAskModelId,
  getAskLlmProvider,
  resetAskLlmSession,
  unloadAskLlm,
} from '../services/llmSession'
import { checkWebGpuSupport, probeWebGpu, resetWebGpuProbeCache } from '../llm/nullProvider'
import { isVaultUnlocked } from '@/features/settings/services/secretsVault'
import { useVaultSessionStore } from '@/features/settings/store/vaultSessionStore'
import { savePreferences } from '@/services/storageService'
import { ASK_MODEL_CATALOG } from '../config/modelCatalog'
import { ASK_PROVIDER_LABELS, modelsForProvider } from '@/types/askSettings'
import { useSqlStore, useQueryStore } from '@/features/sql/store/sqlStore'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`
}

export function useAsk() {
  const files = useFilesStore((s) => s.files)
  const defaultRowLimit = usePreferencesStore((s) => s.defaultRowLimit)
  const askProvider = usePreferencesStore((s) => s.askProvider)
  const askRemoteModelId = usePreferencesStore((s) => s.askRemoteModelId)
  const setAskRemoteModelId = usePreferencesStore((s) => s.setAskRemoteModelId)
  const vaultUnlocked = useVaultSessionStore((s) => s.unlocked)
  const isLocal = askProvider === 'local'
  const setEditorContent = useSqlStore((s) => s.setEditorContent)
  const setResult = useQueryStore((s) => s.setResult)
  const setQueryError = useQueryStore((s) => s.setError)
  const setActiveBottomTab = useWorkspaceStore((s) => s.setActiveBottomTab)
  const setActiveRightTab = useWorkspaceStore((s) => s.setActiveRightTab)

  const selectedModelId = useAskStore((s) => s.selectedModelId)
  const modelReady = useAskStore((s) => s.modelReady)
  const loadProgressText = useAskStore((s) => s.loadProgressText)
  const loadProgress = useAskStore((s) => s.loadProgress)
  const phase = useAskStore((s) => s.phase)
  const busyStartedAt = useAskStore((s) => s.busyStartedAt)
  const streamPreview = useAskStore((s) => s.streamPreview)
  const error = useAskStore((s) => s.error)
  const insightReport = useAskStore((s) => s.insightReport)
  const sqlAskReply = useAskStore((s) => s.sqlAskReply)
  const selectedFileIds = useAskStore((s) => s.selectedFileIds)

  const setSelectedModelId = useAskStore((s) => s.setSelectedModelId)
  const setModelReady = useAskStore((s) => s.setModelReady)
  const setLoadProgress = useAskStore((s) => s.setLoadProgress)
  const setPhase = useAskStore((s) => s.setPhase)
  const setBusyStartedAt = useAskStore((s) => s.setBusyStartedAt)
  const setStreamPreview = useAskStore((s) => s.setStreamPreview)
  const setError = useAskStore((s) => s.setError)
  const setInsightReport = useAskStore((s) => s.setInsightReport)
  const setSqlAskReply = useAskStore((s) => s.setSqlAskReply)
  const setSelectedFileIds = useAskStore((s) => s.setSelectedFileIds)
  const toggleFileId = useAskStore((s) => s.toggleFileId)

  const [elapsedLabel, setElapsedLabel] = useState('')
  const [webGpuState, setWebGpuState] = useState<{ ok: true } | { ok: false; reason: string }>(
    checkWebGpuSupport(),
  )

  const busy =
    phase === 'loadingModel' || phase === 'generatingInsights' || phase === 'answering'

  const activeModelLabel = (() => {
    if (isLocal) {
      const entry = ASK_MODEL_CATALOG.find((m) => m.id === selectedModelId)
      return entry ? `${entry.label} (${entry.sizeHint})` : selectedModelId
    }
    const remote = modelsForProvider(askProvider).find((m) => m.id === askRemoteModelId)
    return remote?.label ?? askRemoteModelId
  })()

  /** Re-sync Ready if the engine is still in memory (e.g. after leaving Home). */
  useEffect(() => {
    try {
      const ready = getAskLlmProvider().isReady()
      if (ready !== useAskStore.getState().modelReady) {
        setModelReady(ready)
      }
    } catch {
      /* ignore */
    }
  }, [askProvider, selectedModelId, askRemoteModelId, setModelReady])

  useEffect(() => {
    if (!isLocal) {
      setWebGpuState({ ok: true })
      return
    }
    let cancelled = false
    void probeWebGpu().then((result) => {
      if (!cancelled) setWebGpuState(result)
    })
    return () => {
      cancelled = true
    }
  }, [isLocal, selectedModelId])

  useEffect(() => {
    if (!busy || !busyStartedAt) {
      setElapsedLabel('')
      return
    }
    const tick = () => {
      const ms = Date.now() - busyStartedAt
      setElapsedLabel(formatElapsed(ms))
      if (phase === 'generatingInsights' || phase === 'answering') {
        toast.loading(
          phase === 'generatingInsights'
            ? `Generating insights… ${formatElapsed(ms)}`
            : `Answering… ${formatElapsed(ms)}`,
          { id: 'ask-busy', duration: Infinity },
        )
      }
      if (phase === 'loadingModel') {
        toast.loading(`Loading model… ${formatElapsed(ms)}`, {
          id: 'ask-model-load',
          duration: Infinity,
        })
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [busy, busyStartedAt, phase])

  /** Keep selection in sync with loaded files: drop removed, default-select new. */
  const prevFileIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const liveIds = files.map((f) => f.id)
    const liveSet = new Set(liveIds)
    const prev = prevFileIdsRef.current
    const current = useAskStore.getState().selectedFileIds
    const kept = current.filter((id) => liveSet.has(id))
    const newlyAdded = liveIds.filter((id) => !prev.has(id))
    prevFileIdsRef.current = liveSet

    let next = kept
    if (prev.size === 0 && liveIds.length > 0) {
      next = liveIds
    } else if (newlyAdded.length > 0) {
      next = [...new Set([...kept, ...newlyAdded])]
    }

    const same =
      next.length === current.length &&
      next.every((id) => current.includes(id)) &&
      current.every((id) => next.includes(id))
    if (!same) setSelectedFileIds(next)
  }, [files, setSelectedFileIds])

  const resolveScopedFileIds = useCallback((): string[] => {
    const live = new Set(files.map((f) => f.id))
    return useAskStore.getState().selectedFileIds.filter((id) => live.has(id))
  }, [files])

  const beginBusy = useCallback(
    (next: 'loadingModel' | 'generatingInsights' | 'answering', text: string, progress: number) => {
      setPhase(next)
      setBusyStartedAt(Date.now())
      setStreamPreview('')
      setError(null)
      setLoadProgress(text, progress)
    },
    [setBusyStartedAt, setError, setLoadProgress, setPhase, setStreamPreview],
  )

  const endBusy = useCallback(() => {
    setBusyStartedAt(null)
    setStreamPreview('')
  }, [setBusyStartedAt, setStreamPreview])

  const loadModel = useCallback(async () => {
    if (isLocal) {
      resetWebGpuProbeCache()
      const gpu = await probeWebGpu()
      if (!gpu.ok) {
        setWebGpuState(gpu)
        setError(gpu.reason)
        toast.error(gpu.reason)
        return
      }
      setWebGpuState(gpu)
    } else if (!isVaultUnlocked()) {
      const msg = 'Unlock the encrypted API vault in Settings before connecting a remote model.'
      setError(msg)
      toast.error(msg)
      return
    }

    // Already loaded for this session — do not download / reconnect again
    try {
      const existing = getAskLlmProvider()
      if (existing.isReady()) {
        setModelReady(true)
        setPhase('idle')
        setLoadProgress('Model ready', 1)
        toast.success(isLocal ? 'Model already loaded this session' : 'Already connected this session')
        return
      }
    } catch {
      /* continue to load */
    }

    beginBusy(
      'loadingModel',
      isLocal ? 'Starting model download…' : 'Connecting to API…',
      0.01,
    )
    setModelReady(false)
    toast.loading(
      isLocal
        ? 'Loading local model — this can take a few minutes the first time'
        : 'Connecting remote model…',
      {
        id: 'ask-model-load',
        duration: Infinity,
      },
    )

    try {
      await resetAskLlmSession()
      const provider = getAskLlmProvider()
      const modelId = getActiveAskModelId()
      await provider.load(modelId, (p) => {
        setLoadProgress(p.text, p.progress)
      })

      if (!provider.isReady()) {
        throw new Error('Model finished loading but is not ready. Try again.')
      }

      setModelReady(true)
      setPhase('idle')
      setLoadProgress('Model ready', 1)
      endBusy()
      toast.success(
        isLocal
          ? 'Local model ready — stays loaded until you clear it or refresh the page'
          : 'Remote model connected',
        { id: 'ask-model-load' },
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load model'
      setModelReady(false)
      setError(message)
      setPhase('error')
      endBusy()
      toast.error(message, { id: 'ask-model-load' })
    }
  }, [beginBusy, endBusy, isLocal, setError, setLoadProgress, setModelReady, setPhase])

  const runGenerateInsights = useCallback(async () => {
    const provider = getAskLlmProvider()
    if (!provider.isReady() || !useAskStore.getState().modelReady) {
      toast.error('Load a model first in Insights — wait until status shows Ready')
      return
    }
    const fileIds = resolveScopedFileIds()
    if (fileIds.length === 0) {
      toast.error('Select at least one table in Insights or the Ask bar')
      return
    }

    beginBusy('generatingInsights', 'Building table context…', 0.15)
    setInsightReport(null)
    toast.loading(
      isLocal ? 'Generating insights… (local model is running)' : 'Generating insights…',
      {
        id: 'ask-busy',
        duration: Infinity,
      },
    )

    try {
      const contexts = await buildFileContexts(files, fileIds)
      const report = await generateInsightReport(
        provider,
        contexts,
        defaultRowLimit,
        (status) => {
          setLoadProgress(status, 0.55)
          setStreamPreview(status)
        },
      )
      setInsightReport(report)
      setPhase('idle')
      setLoadProgress('', 0)
      endBusy()
      setActiveRightTab('ask')
      toast.success('Insights ready', { id: 'ask-busy' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generate insights failed'
      setError(message)
      setPhase('error')
      endBusy()
      toast.error(message, { id: 'ask-busy' })
    }
  }, [
    beginBusy,
    defaultRowLimit,
    endBusy,
    files,
    isLocal,
    resolveScopedFileIds,
    setActiveRightTab,
    setError,
    setInsightReport,
    setLoadProgress,
    setPhase,
    setStreamPreview,
  ])

  const runAskQuestion = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question) {
        toast.error('Type a question about your data')
        return
      }

      const provider = getAskLlmProvider()
      if (!provider.isReady() || !useAskStore.getState().modelReady) {
        toast.error('Open Insights and load a model first')
        setActiveRightTab('ask')
        return
      }

      const fileIds = resolveScopedFileIds()
      if (fileIds.length === 0) {
        toast.error('Select at least one table first')
        return
      }

      beginBusy('answering', 'Writing SQL for your question…', 0.2)
      setSqlAskReply(null)
      toast.loading(isLocal ? 'Answering… (local model is running)' : 'Answering…', {
        id: 'ask-busy',
        duration: Infinity,
      })

      try {
        const contexts = await buildFileContexts(files, fileIds)
        const answer = await answerQuestion(
          provider,
          contexts,
          `sql-ask-${Date.now()}`,
          question,
          defaultRowLimit,
          (status) => {
            setLoadProgress(status, 0.6)
            setStreamPreview(status)
          },
        )

        if (answer.sql) {
          setEditorContent(answer.sql.endsWith(';') ? answer.sql : `${answer.sql};`)
        }

        if (answer.error) {
          setQueryError(answer.error)
          setSqlAskReply({
            question,
            answer: '',
            sql: answer.sql,
            steps: answer.steps,
            error: answer.error,
          })
          setPhase('error')
          setError(answer.error)
          endBusy()
          setActiveBottomTab('results')
          toast.error(answer.error, { id: 'ask-busy' })
          return
        }

        setResult({
          columns: answer.columns,
          columnTypes: answer.columns.map(() => 'VARCHAR'),
          rows: answer.previewRows,
          totalRows: answer.rowCount,
          durationMs: 0,
        })
        setSqlAskReply({
          question,
          answer: answer.answer,
          sql: answer.sql,
          steps: answer.steps,
        })
        setPhase('idle')
        setLoadProgress('', 0)
        endBusy()
        setActiveBottomTab('results')
        toast.success(
          answer.steps && answer.steps.length > 1
            ? `Answer ready (${answer.steps.length} SQL steps)`
            : 'SQL ready — results below',
          { id: 'ask-busy' },
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to answer'
        setSqlAskReply({ question, answer: '', sql: '', error: message })
        setError(message)
        setPhase('error')
        endBusy()
        toast.error(message, { id: 'ask-busy' })
      }
    },
    [
      beginBusy,
      defaultRowLimit,
      endBusy,
      files,
      isLocal,
      resolveScopedFileIds,
      setActiveBottomTab,
      setActiveRightTab,
      setEditorContent,
      setError,
      setLoadProgress,
      setPhase,
      setQueryError,
      setResult,
      setSqlAskReply,
      setStreamPreview,
    ],
  )

  const unload = useCallback(async () => {
    toast.dismiss('ask-model-load')
    toast.dismiss('ask-busy')
    await unloadAskLlm()
    await resetAskLlmSession()
    setModelReady(false)
    setLoadProgress('', 0)
    setPhase('idle')
    endBusy()
    toast.message(isLocal ? 'Model cleared from memory' : 'Remote connection cleared')
  }, [endBusy, isLocal, setLoadProgress, setModelReady, setPhase])

  const selectModel = useCallback(
    (id: string) => {
      setSelectedModelId(id)
      setModelReady(false)
      setLoadProgress('', 0)
      void resetAskLlmSession()
    },
    [setLoadProgress, setModelReady, setSelectedModelId],
  )

  const selectRemoteModel = useCallback(
    (id: string) => {
      setAskRemoteModelId(id)
      void savePreferences({ askRemoteModelId: id })
      setModelReady(false)
      setLoadProgress('', 0)
      void resetAskLlmSession()
    },
    [setAskRemoteModelId, setLoadProgress, setModelReady],
  )

  const selectAllTables = useCallback(() => {
    setSelectedFileIds(files.map((f) => f.id))
  }, [files, setSelectedFileIds])

  const selectNoTables = useCallback(() => {
    setSelectedFileIds([])
  }, [setSelectedFileIds])

  return {
    selectedModelId,
    activeModelLabel,
    providerLabel: ASK_PROVIDER_LABELS[askProvider],
    modelReady,
    loadProgressText,
    loadProgress,
    phase,
    busyStartedAt,
    streamPreview,
    elapsedLabel,
    error,
    insightReport,
    sqlAskReply,
    selectedFileIds,
    files,
    askProvider,
    askRemoteModelId,
    isLocal,
    webGpu: webGpuState,
    vaultUnlocked,
    setSelectedModelId: selectModel,
    setAskRemoteModelId: selectRemoteModel,
    setSelectedFileIds,
    toggleFileId,
    selectAllTables,
    selectNoTables,
    loadModel,
    runGenerateInsights,
    runAskQuestion,
    unload,
  }
}
