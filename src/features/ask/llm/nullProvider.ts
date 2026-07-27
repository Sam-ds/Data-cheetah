import type { ChatMessage, LlmProvider } from './types'

export function createNullProvider(reason: string): LlmProvider {
  return {
    id: 'null',
    async load() {
      throw new Error(reason)
    },
    async unload() {},
    isReady() {
      return false
    },
    async complete(_messages: ChatMessage[]) {
      throw new Error(reason)
    },
  }
}

export function checkWebGpuSupport(): { ok: true } | { ok: false; reason: string } {
  if (typeof navigator === 'undefined') {
    return { ok: false, reason: 'WebLLM requires a browser environment.' }
  }
  if (!('gpu' in navigator)) {
    return {
      ok: false,
      reason: 'WebGPU is not available in this browser. Try Chrome/Edge 113+ with WebGPU enabled.',
    }
  }
  return { ok: true }
}

let cachedGpuProbe: { ok: true } | { ok: false; reason: string } | null = null

/** Actually request a WebGPU device (catches DXGI / driver errors that sync checks miss). */
export async function probeWebGpu(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const basic = checkWebGpuSupport()
  if (!basic.ok) return basic
  if (cachedGpuProbe) return cachedGpuProbe

  try {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu
    if (!gpu) {
      cachedGpuProbe = { ok: false, reason: 'WebGPU is not available.' }
      return cachedGpuProbe
    }
    const adapter = await gpu.requestAdapter()
    if (!adapter) {
      cachedGpuProbe = { ok: false, reason: 'No WebGPU adapter found.' }
      return cachedGpuProbe
    }
    const device = await adapter.requestDevice()
    device.destroy()
    cachedGpuProbe = { ok: true }
    return cachedGpuProbe
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/DXGI_ERROR_DEVICE_REMOVED|requestDevice|D3D12|GPUAdapter|WebGPU/i.test(msg)) {
      cachedGpuProbe = {
        ok: false,
        reason:
          'Local GPU/WebGPU failed (often a driver reset on Windows). Use OpenAI or Claude in Settings, or turn off LLM seed rows.',
      }
    } else {
      cachedGpuProbe = {
        ok: false,
        reason: msg.length > 180 ? `${msg.slice(0, 177)}…` : msg,
      }
    }
    return cachedGpuProbe
  }
}

/** Call after a hard GPU failure so the next probe re-runs. */
export function resetWebGpuProbeCache(): void {
  cachedGpuProbe = null
}
