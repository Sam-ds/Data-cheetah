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

async function resolveApiKey(
  getApiKey: () => string | undefined | Promise<string | undefined>,
): Promise<string | undefined> {
  const value = await getApiKey()
  return value?.trim() || undefined
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

function openRouterHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://datacheetah.app',
    'X-Title': 'DataCheetah',
  }
}

/** OpenAI Chat Completions (OpenRouter and compatible gateways). */
export function createOpenAiCompatibleProvider(opts: {
  id: string
  getApiKey: () => string | undefined | Promise<string | undefined>
  getBaseUrl: () => string
  getModelId: () => string
}): LlmProvider {
  let ready = false
  let loadedModel = ''

  return {
    id: opts.id,

    async load(modelId: string, onProgress?: (p: LoadProgress) => void) {
      onProgress?.({ text: 'Checking API key…', progress: 0.2 })
      const key = await resolveApiKey(opts.getApiKey)
      if (!key) {
        throw new Error('API key missing — paste your OpenRouter API key in Settings.')
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
      const key = await resolveApiKey(opts.getApiKey)
      if (!key) throw new Error('API key missing — paste your OpenRouter API key in Settings.')
      const base = opts.getBaseUrl().replace(/\/$/, '')
      const model = loadedModel || opts.getModelId()
      const stream = !!completeOpts?.onChunk

      const headers =
        opts.id === 'openrouter'
          ? openRouterHeaders(key)
          : {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            }

      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers,
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
