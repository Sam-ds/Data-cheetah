import type { ChatMessage, LlmProvider, LoadProgress } from './types'
import { checkWebGpuSupport, createNullProvider } from './nullProvider'

type MlcEngine = {
  reload: (modelId: string) => Promise<void>
  unload: () => Promise<void>
  chat: {
    completions: {
      create: (req: {
        messages: { role: string; content: string }[]
        temperature?: number
        stream?: boolean
        model?: string
      }) => Promise<
        | { choices: { message?: { content?: string } }[] }
        | AsyncIterable<{ choices: { delta?: { content?: string } }[] }>
      >
    }
  }
}

/**
 * Lazy WebLLM provider — uses CreateMLCEngine so the model is actually loaded
 * before chat.completions APIs are used.
 */
export function createWebLlmProvider(): LlmProvider {
  let engine: MlcEngine | null = null
  let loadedModelId: string | null = null

  async function disposeEngine() {
    if (!engine) return
    try {
      await engine.unload()
    } catch {
      /* ignore */
    }
    engine = null
    loadedModelId = null
  }

  return {
    id: 'webllm',

    async load(modelId: string, onProgress?: (p: LoadProgress) => void) {
      const gpu = checkWebGpuSupport()
      if (!gpu.ok) {
        throw new Error(gpu.reason)
      }

      onProgress?.({ text: 'Preparing WebGPU / downloading model files…', progress: 0.02 })
      await disposeEngine()

      const webllm = await import('@mlc-ai/web-llm')

      engine = (await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report: { text?: string; progress?: number }) => {
          onProgress?.({
            text: report.text || 'Loading model into GPU…',
            progress: typeof report.progress === 'number' ? report.progress : 0,
          })
        },
      })) as unknown as MlcEngine

      loadedModelId = modelId
      onProgress?.({ text: 'Model ready', progress: 1 })
    },

    async unload() {
      await disposeEngine()
    },

    isReady() {
      return engine != null && loadedModelId != null
    },

    async complete(messages: ChatMessage[], opts?: { temperature?: number; onChunk?: (accumulated: string) => void }) {
      if (!engine || !loadedModelId) {
        throw new Error('Load a model before generating. Click “Load model” in the Ask panel.')
      }

      const base = {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: opts?.temperature ?? 0.2,
        model: loadedModelId,
      }

      // Stream when possible so the UI can show live activity
      if (opts?.onChunk) {
        const stream = (await engine.chat.completions.create({
          ...base,
          stream: true,
        })) as AsyncIterable<{ choices: { delta?: { content?: string } }[] }>

        let accumulated = ''
        for await (const chunk of stream) {
          const piece = chunk.choices[0]?.delta?.content ?? ''
          if (piece) {
            accumulated += piece
            opts.onChunk(accumulated)
          }
        }
        if (!accumulated.trim()) {
          throw new Error('Model returned an empty response.')
        }
        return accumulated.trim()
      }

      const reply = (await engine.chat.completions.create({
        ...base,
        stream: false,
      })) as { choices: { message?: { content?: string } }[] }

      const content = reply.choices[0]?.message?.content
      if (!content?.trim()) {
        throw new Error('Model returned an empty response.')
      }
      return content.trim()
    },
  }
}

export function createAskLlmProvider(): LlmProvider {
  const gpu = checkWebGpuSupport()
  if (!gpu.ok) {
    return createNullProvider(gpu.reason)
  }
  return createWebLlmProvider()
}
