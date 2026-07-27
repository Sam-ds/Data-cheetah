import type { ChatMessage, LlmProvider, LoadProgress } from './types'

function extractTextFromChatCompletion(data: unknown): string {
  const d = data as {
    choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[]
    error?: { message?: string }
  }
  if (d.error?.message) throw new Error(d.error.message)
  const content = d.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'object' && c && 'text' in c ? String(c.text ?? '') : ''))
      .join('')
      .trim()
  }
  return ''
}

async function readSseOrJson(
  res: Response,
  onChunk?: (accumulated: string) => void,
): Promise<string> {
  const ctype = res.headers.get('content-type') || ''
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(errText || `HTTP ${res.status}`)
  }

  if (ctype.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n')
      buffer = parts.pop() ?? ''
      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string }; message?: { content?: string } }[]
          }
          const piece =
            json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? ''
          if (piece) {
            accumulated += piece
            onChunk?.(accumulated)
          }
        } catch {
          /* ignore partial SSE */
        }
      }
    }
    if (!accumulated.trim()) throw new Error('Model returned an empty response.')
    return accumulated.trim()
  }

  const json = await res.json()
  const text = extractTextFromChatCompletion(json)
  if (!text) throw new Error('Model returned an empty response.')
  onChunk?.(text)
  return text
}

/** OpenAI Chat Completions (also Moonshot / compatible gateways). */
export function createOpenAiCompatibleProvider(opts: {
  id: string
  getApiKey: () => string | undefined
  getBaseUrl: () => string
  getModelId: () => string
}): LlmProvider {
  let ready = false
  let loadedModel = ''

  return {
    id: opts.id,

    async load(modelId: string, onProgress?: (p: LoadProgress) => void) {
      onProgress?.({ text: 'Checking API key…', progress: 0.2 })
      const key = opts.getApiKey()?.trim()
      if (!key) {
        throw new Error('API key missing — unlock the vault in Settings and save a key for this provider.')
      }
      const base = opts.getBaseUrl().replace(/\/$/, '')
      if (!base) throw new Error('Base URL is required')
      loadedModel = modelId || opts.getModelId()
      ready = true
      onProgress?.({ text: 'API ready', progress: 1 })
    },

    async unload() {
      ready = false
      loadedModel = ''
    },

    isReady() {
      return ready && !!loadedModel
    },

    async complete(messages: ChatMessage[], completeOpts?: { temperature?: number; onChunk?: (a: string) => void }) {
      if (!ready) throw new Error('Call Load / Connect first.')
      const key = opts.getApiKey()?.trim()
      if (!key) throw new Error('API key missing — unlock Settings vault.')
      const base = opts.getBaseUrl().replace(/\/$/, '')
      const model = loadedModel || opts.getModelId()
      const stream = !!completeOpts?.onChunk

      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: completeOpts?.temperature ?? 0.2,
          stream,
        }),
      })

      return readSseOrJson(res, completeOpts?.onChunk)
    },
  }
}

export function createAnthropicProvider(opts: {
  getApiKey: () => string | undefined
  getModelId: () => string
}): LlmProvider {
  let ready = false
  let loadedModel = ''

  return {
    id: 'anthropic',

    async load(modelId: string, onProgress?: (p: LoadProgress) => void) {
      onProgress?.({ text: 'Checking Anthropic API key…', progress: 0.2 })
      if (!opts.getApiKey()?.trim()) {
        throw new Error('Anthropic API key missing — unlock the vault in Settings and save it.')
      }
      loadedModel = modelId || opts.getModelId()
      ready = true
      onProgress?.({ text: 'Claude API ready', progress: 1 })
    },

    async unload() {
      ready = false
      loadedModel = ''
    },

    isReady() {
      return ready && !!loadedModel
    },

    async complete(messages: ChatMessage[], completeOpts?: { temperature?: number; onChunk?: (a: string) => void }) {
      if (!ready) throw new Error('Call Load / Connect first.')
      const key = opts.getApiKey()?.trim()
      if (!key) throw new Error('Anthropic API key missing.')
      const model = loadedModel || opts.getModelId()

      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
      const anthropicMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }))

      const stream = !!completeOpts?.onChunk
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: completeOpts?.temperature ?? 0.2,
          system: system || undefined,
          messages: anthropicMessages,
          stream,
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(errText || `Anthropic HTTP ${res.status}`)
      }

      if (stream && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n')
          buffer = parts.pop() ?? ''
          for (const line of parts) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (!data || data === '[DONE]') continue
            try {
              const json = JSON.parse(data) as {
                type?: string
                delta?: { type?: string; text?: string }
              }
              if (json.type === 'content_block_delta' && json.delta?.text) {
                accumulated += json.delta.text
                completeOpts?.onChunk?.(accumulated)
              }
            } catch {
              /* ignore */
            }
          }
        }
        if (!accumulated.trim()) throw new Error('Model returned an empty response.')
        return accumulated.trim()
      }

      const json = (await res.json()) as {
        content?: { type?: string; text?: string }[]
        error?: { message?: string }
      }
      if (json.error?.message) throw new Error(json.error.message)
      const text = (json.content ?? [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('')
        .trim()
      if (!text) throw new Error('Model returned an empty response.')
      return text
    },
  }
}

export function createGeminiProvider(opts: {
  getApiKey: () => string | undefined
  getModelId: () => string
}): LlmProvider {
  let ready = false
  let loadedModel = ''

  return {
    id: 'gemini',

    async load(modelId: string, onProgress?: (p: LoadProgress) => void) {
      onProgress?.({ text: 'Checking Gemini API key…', progress: 0.2 })
      if (!opts.getApiKey()?.trim()) {
        throw new Error('Gemini API key missing — unlock the vault in Settings and save it.')
      }
      loadedModel = modelId || opts.getModelId()
      ready = true
      onProgress?.({ text: 'Gemini API ready', progress: 1 })
    },

    async unload() {
      ready = false
      loadedModel = ''
    },

    isReady() {
      return ready && !!loadedModel
    },

    async complete(messages: ChatMessage[], completeOpts?: { temperature?: number; onChunk?: (a: string) => void }) {
      if (!ready) throw new Error('Call Load / Connect first.')
      const key = opts.getApiKey()?.trim()
      if (!key) throw new Error('Gemini API key missing.')
      const model = loadedModel || opts.getModelId()

      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
          generationConfig: { temperature: completeOpts?.temperature ?? 0.2 },
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(errText || `Gemini HTTP ${res.status}`)
      }

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
        error?: { message?: string }
      }
      if (json.error?.message) throw new Error(json.error.message)
      const text = (json.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('')
        .trim()
      if (!text) throw new Error('Model returned an empty response.')
      completeOpts?.onChunk?.(text)
      return text
    },
  }
}
