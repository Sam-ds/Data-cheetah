import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useFilesStore } from '@/features/files/store/filesStore'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { useAskStore } from '../store/askStore'
import { buildFileContexts } from '../services/contextBuilder'
import { generateQuestions } from '../services/questionService'
import { answerQuestion } from '../services/answerService'
import {
  getActiveAskModelId,
  getAskLlmProvider,
  resetAskLlmSession,
  unloadAskLlm,
} from '../services/llmSession'
import { checkWebGpuSupport } from '../llm/nullProvider'
import { isVaultUnlocked } from '@/features/settings/services/secretsVault'
import { useVaultSessionStore } from '@/features/settings/store/vaultSessionStore'
import { savePreferences } from '@/services/storageService'

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`
}

export function useAsk() {
  const files = useFilesStore((s) => s.files)
  const setFileSchemaDoc = useFilesStore((s) => s.setFileSchemaDoc)
  const defaultRowLimit = usePreferencesStore((s) => s.defaultRowLimit)
  const askProvider = usePreferencesStore((s) => s.askProvider)
  const askRemoteModelId = usePreferencesStore((s) => s.askRemoteModelId)
  const setAskRemoteModelId = usePreferencesStore((s) => s.setAskRemoteModelId)
  const vaultUnlocked = useVaultSessionStore((s) => s.unlocked)
  const isLocal = askProvider === 'local'

  const selectedModelId = useAskStore((s) => s.selectedModelId)
  const modelReady = useAskStore((s) => s.modelReady)
  const loadProgressText = useAskStore((s) => s.loadProgressText)
  const loadProgress = useAskStore((s) => s.loadProgress)
  const phase = useAskStore((s) => s.phase)
  const busyStartedAt = useAskStore((s) => s.busyStartedAt)
  const streamPreview = useAskStore((s) => s.streamPreview)
  const error = useAskStore((s) => s.error)
  const selectedFileIds = useAskStore((s) => s.selectedFileIds)
  const questions = useAskStore((s) => s.questions)
  const activeQuestionId = useAskStore((s) => s.activeQuestionId)
  const answers = useAskStore((s) => s.answers)

  const setSelectedModelId = useAskStore((s) => s.setSelectedModelId)
  const setModelReady = useAskStore((s) => s.setModelReady)
  const setLoadProgress = useAskStore((s) => s.setLoadProgress)
  const setPhase = useAskStore((s) => s.setPhase)
  const setBusyStartedAt = useAskStore((s) => s.setBusyStartedAt)
  const setStreamPreview = useAskStore((s) => s.setStreamPreview)
  const setError = useAskStore((s) => s.setError)
  const setSelectedFileIds = useAskStore((s) => s.setSelectedFileIds)
  const toggleFileId = useAskStore((s) => s.toggleFileId)
  const setQuestions = useAskStore((s) => s.setQuestions)
  const setActiveQuestionId = useAskStore((s) => s.setActiveQuestionId)
  const setAnswer = useAskStore((s) => s.setAnswer)

  const [elapsedLabel, setElapsedLabel] = useState('')

  const busy =
    phase === 'loadingModel' || phase === 'generatingQuestions' || phase === 'answering'

  useEffect(() => {
    if (!busy || !busyStartedAt) {
      setElapsedLabel('')
      return
    }
    const tick = () => {
      const ms = Date.now() - busyStartedAt
      setElapsedLabel(formatElapsed(ms))
      if (phase === 'generatingQuestions' || phase === 'answering') {
        toast.loading(
          phase === 'generatingQuestions'
            ? `Sample insights… ${formatElapsed(ms)} (model is working)`
            : `Answering… ${formatElapsed(ms)} (model is working)`,
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

  const beginBusy = useCallback(
    (next: 'loadingModel' | 'generatingQuestions' | 'answering', text: string, progress: number) => {
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
      const gpu = checkWebGpuSupport()
      if (!gpu.ok) {
        setError(gpu.reason)
        toast.error(gpu.reason)
        return
      }
    } else if (!isVaultUnlocked()) {
      const msg = 'Unlock the encrypted API vault in Settings before connecting a remote model.'
      setError(msg)
      toast.error(msg)
      return
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
      toast.success(isLocal ? 'Local model ready' : 'Remote model connected', {
        id: 'ask-model-load',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load model'
      setModelReady(false)
      setError(message)
      setPhase('error')
      endBusy()
      toast.error(message, { id: 'ask-model-load' })
    }
  }, [beginBusy, endBusy, isLocal, setError, setLoadProgress, setModelReady, setPhase])

  const runGenerateQuestions = useCallback(async () => {
    const provider = getAskLlmProvider()
    if (!provider.isReady() || !useAskStore.getState().modelReady) {
      toast.error('Load a model first — wait until status shows Ready')
      return
    }
    const fileIds = useAskStore.getState().selectedFileIds
    if (fileIds.length === 0) {
      toast.error('Select at least one file')
      return
    }

    beginBusy('generatingQuestions', 'Building table context…', 0.15)
    toast.loading(
      isLocal ? 'Generating sample insights… (local model is running)' : 'Generating sample insights…',
      {
      id: 'ask-busy',
      duration: Infinity,
    })

    try {
      const contexts = await buildFileContexts(files, fileIds)
      setLoadProgress('Model is generating sample insights — please wait…', 0.4)
      const nextQuestions = await generateQuestions(provider, contexts, (chunk) => {
        setStreamPreview(chunk.slice(-400))
        setLoadProgress(`Model writing… ${chunk.length} characters`, 0.55)
      })
      setQuestions(nextQuestions)
      setPhase('idle')
      setLoadProgress('', 0)
      endBusy()
      toast.success(`${nextQuestions.length} sample insights ready`, { id: 'ask-busy' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sample insights failed'
      setError(message)
      setPhase('error')
      endBusy()
      toast.error(message, { id: 'ask-busy' })
    }
  }, [beginBusy, endBusy, files, isLocal, setError, setLoadProgress, setPhase, setQuestions, setStreamPreview])

  const runAnswer = useCallback(
    async (questionId: string, questionText?: string) => {
      const provider = getAskLlmProvider()
      if (!provider.isReady() || !useAskStore.getState().modelReady) {
        toast.error('Load a model first — wait until status shows Ready')
        return
      }

      const existing = useAskStore.getState().questions.find((x) => x.id === questionId)
      const question = (questionText ?? existing?.question ?? '').trim()
      if (!question) return

      // Keep custom questions in the list so they remain clickable
      if (!existing) {
        setQuestions([
          ...useAskStore.getState().questions.filter((q) => q.id !== questionId),
          { id: questionId, question },
        ])
      }

      const fileIds = useAskStore.getState().selectedFileIds
      if (fileIds.length === 0) {
        toast.error('Select at least one file')
        return
      }

      setActiveQuestionId(questionId)
      beginBusy('answering', 'Preparing answer…', 0.2)
      toast.loading(isLocal ? 'Answering… (local model is running)' : 'Answering…', {
        id: 'ask-busy',
        duration: Infinity,
      })

      try {
        const contexts = await buildFileContexts(files, fileIds)
        const answer = await answerQuestion(
          provider,
          contexts,
          questionId,
          question,
          defaultRowLimit,
          (status) => {
            setLoadProgress(status, 0.6)
            setStreamPreview(status)
          },
        )
        setAnswer(answer)
        setPhase('idle')
        setLoadProgress('', 0)
        endBusy()
        toast.success('Answer ready', { id: 'ask-busy' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to answer'
        setAnswer({
          questionId,
          sql: '',
          answer: '',
          rowCount: 0,
          previewRows: [],
          columns: [],
          error: message,
        })
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
      setActiveQuestionId,
      setAnswer,
      setError,
      setLoadProgress,
      setPhase,
      setQuestions,
      setStreamPreview,
    ],
  )

  const runCustomQuestion = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question) {
        toast.error('Type a question about your data')
        return
      }
      const id = `custom-${Date.now()}`
      await runAnswer(id, question)
    },
    [runAnswer],
  )

  const unload = useCallback(async () => {
    toast.dismiss('ask-model-load')
    toast.dismiss('ask-busy')
    await unloadAskLlm()
    setModelReady(false)
    setLoadProgress('', 0)
    setPhase('idle')
    endBusy()
  }, [endBusy, setLoadProgress, setModelReady, setPhase])

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

  const attachSchemaDoc = useCallback(
    (fileId: string, doc: import('@/types/schemaDoc').TableSchemaDoc) => {
      setFileSchemaDoc(fileId, doc)
    },
    [setFileSchemaDoc],
  )

  const clearSchemaDoc = useCallback(
    (fileId: string) => {
      setFileSchemaDoc(fileId, undefined)
    },
    [setFileSchemaDoc],
  )

  const attachSchemaDocs = useCallback(
    (docs: import('@/types/schemaDoc').TableSchemaDoc[]) => {
      const attached: string[] = []
      const missed: string[] = []
      const attachByName = useFilesStore.getState().attachSchemaDocByTableName
      for (const doc of docs) {
        const table = attachByName(doc)
        if (table) attached.push(table)
        else missed.push(doc.table)
      }
      return { attached, missed }
    },
    [],
  )

  const clearAllSchemaDocs = useCallback(() => {
    for (const f of useFilesStore.getState().files) {
      setFileSchemaDoc(f.id, undefined)
    }
  }, [setFileSchemaDoc])

  return {
    selectedModelId,
    modelReady,
    loadProgressText,
    loadProgress,
    phase,
    busyStartedAt,
    streamPreview,
    elapsedLabel,
    error,
    selectedFileIds,
    questions,
    activeQuestionId,
    answers,
    files,
    askProvider,
    askRemoteModelId,
    isLocal,
    webGpu: checkWebGpuSupport(),
    vaultUnlocked,
    setSelectedFileIds,
    toggleFileId,
    setSelectedModelId: selectModel,
    setAskRemoteModelId: selectRemoteModel,
    attachSchemaDoc,
    clearSchemaDoc,
    attachSchemaDocs,
    clearAllSchemaDocs,
    loadModel,
    runGenerateQuestions,
    runAnswer,
    runCustomQuestion,
    unload,
  }
}
