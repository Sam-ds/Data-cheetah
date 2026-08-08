/** Tiny authenticated probe — does not send your datasets. */
export async function testOpenRouterApiKey(
  apiKey: string,
  modelId?: string,
): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  try {
    const key = apiKey.trim()
    if (!key) return { ok: false, detail: 'Paste an OpenRouter API key first' }

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.ok) return { ok: true, detail: 'OpenRouter key works' }

    const chat = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://datacheetah.app',
        'X-Title': 'DataCheetah',
      },
      body: JSON.stringify({
        model: modelId?.trim() || 'openai/gpt-4o',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    })
    if (!chat.ok) return { ok: false, detail: await briefError(chat) }
    return { ok: true, detail: 'OpenRouter key works' }
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : 'Network error testing key',
    }
  }
}

async function briefError(res: Response): Promise<string> {
  try {
    const text = await res.text()
    const trimmed = text.trim()
    if (!trimmed) return `HTTP ${res.status}`
    try {
      const json = JSON.parse(trimmed) as { error?: { message?: string }; message?: string }
      return json.error?.message || json.message || trimmed.slice(0, 180)
    } catch {
      return trimmed.slice(0, 180)
    }
  } catch {
    return `HTTP ${res.status}`
  }
}
