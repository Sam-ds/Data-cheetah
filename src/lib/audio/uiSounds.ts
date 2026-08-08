/** Near-zero-size UI sounds via Web Audio (no media files in the bundle). */

let sharedCtx: AudioContext | null = null
let lastClickAt = 0

function getCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new Ctx()
    }
    if (sharedCtx.state === 'suspended') {
      void sharedCtx.resume()
    }
    return sharedCtx
  } catch {
    return null
  }
}

function tone(
  ctx: AudioContext,
  {
    frequency,
    start,
    duration,
    type = 'sine',
    gain = 0.04,
  }: {
    frequency: number
    start: number
    duration: number
    type?: OscillatorType
    gain?: number
  },
) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, start)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.008)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

/** Soft tick for primary UI presses. */
export function playClick(): void {
  const now = performance.now()
  if (now - lastClickAt < 55) return
  lastClickAt = now

  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, { frequency: 920, start: t, duration: 0.028, type: 'triangle', gain: 0.028 })
}

/** Brief chime when generation / export finishes. */
export function playSuccess(): void {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, { frequency: 523.25, start: t, duration: 0.12, type: 'sine', gain: 0.045 })
  tone(ctx, { frequency: 659.25, start: t + 0.08, duration: 0.16, type: 'sine', gain: 0.04 })
}
