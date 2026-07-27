import type { AskSecretsPayload } from '@/types/askSettings'
import type { AskProviderId } from '@/types/askSettings'

export type TestableProvider = Exclude<AskProviderId, 'local'>

/** Tiny authenticated probe — does not send your datasets. */
export async function testProviderApiKey(
  provider: TestableProvider,
  secrets: AskSecretsPayload,
  modelId?: string,
): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  try {
    switch (provider) {
      case 'openai': {
        const key = secrets.openaiApiKey?.trim()
        if (!key) return { ok: false, detail: 'Paste an OpenAI API key first' }
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        })
        if (!res.ok) return { ok: false, detail: await briefError(res) }
        return { ok: true, detail: 'OpenAI key works' }
      }
      case 'kimi': {
        const key = secrets.kimiApiKey?.trim()
        if (!key) return { ok: false, detail: 'Paste a Kimi / Moonshot API key first' }
        const res = await fetch('https://api.moonshot.cn/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        })
        if (!res.ok) return { ok: false, detail: await briefError(res) }
        return { ok: true, detail: 'Kimi key works' }
      }
      case 'openai-compatible': {
        const key = secrets.openaiCompatibleApiKey?.trim()
        const base = (secrets.openaiCompatibleBaseUrl?.trim() || 'https://api.openai.com/v1').replace(
          /\/$/,
          '',
        )
        if (!key) return { ok: false, detail: 'Paste a compatible API key first' }
        const res = await fetch(`${base}/models`, {
          headers: { Authorization: `Bearer ${key}` },
        })
        if (!res.ok) {
          // Some gateways lack /models — try a tiny chat call
          const chat = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: modelId || 'gpt-4o-mini',
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 1,
            }),
          })
          if (!chat.ok) return { ok: false, detail: await briefError(chat) }
          return { ok: true, detail: 'Compatible endpoint accepted the key' }
        }
        return { ok: true, detail: 'Compatible endpoint key works' }
      }
      case 'anthropic': {
        const key = secrets.anthropicApiKey?.trim()
        if (!key) return { ok: false, detail: 'Paste an Anthropic API key first' }
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: modelId || 'claude-haiku-4-20250414',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        })
        if (!res.ok) return { ok: false, detail: await briefError(res) }
        return { ok: true, detail: 'Claude / Anthropic key works' }
      }
      case 'gemini': {
        const key = secrets.geminiApiKey?.trim()
        if (!key) return { ok: false, detail: 'Paste a Gemini API key first' }
        const model = modelId || 'gemini-2.0-flash'
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        })
        if (!res.ok) return { ok: false, detail: await briefError(res) }
        return { ok: true, detail: 'Gemini key works' }
      }
      default:
        return { ok: false, detail: 'Unknown provider' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/Failed to fetch|NetworkError|CORS/i.test(msg)) {
      return {
        ok: false,
        detail:
          'Browser blocked the request (CORS/network). The key may still work from Ask; try Connect there, or use an OpenAI-compatible gateway.',
      }
    }
    return { ok: false, detail: msg }
  }
}

async function briefError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string }
      message?: string
    }
    return json.error?.message || json.message || `HTTP ${res.status}`
  } catch {
    return text.slice(0, 180) || `HTTP ${res.status}`
  }
}
