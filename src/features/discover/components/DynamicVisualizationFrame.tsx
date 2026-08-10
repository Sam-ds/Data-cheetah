import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Loader2, Maximize2, Minimize2 } from 'lucide-react'
import threeCoreRuntime from '../../../../node_modules/three/build/three.core.min.js?raw'
import threeModuleRuntime from '../../../../node_modules/three/build/three.module.min.js?raw'
import {
  DYNAMIC_MESSAGE_SOURCE,
  MAX_DYNAMIC_PAYLOAD_BYTES,
  dynamicPayloadSize,
  isDynamicHostMessage,
  type DynamicRenderMessage,
  type DynamicVisualizationPayload,
} from '../services/dynamicVisualizationProtocol'
import { cn } from '@/lib/utils/cn'

function escapeInlineScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script')
}

const HOST_MODULE = String.raw`
const SOURCE = 'datacheetah-dynamic-v1'
let cleanup = null

const reportHeight = (preferred) => {
  const height = preferred != null && Number.isFinite(Number(preferred))
    ? Math.ceil(Number(preferred))
    : Math.ceil(document.documentElement.scrollHeight)
  parent.postMessage({ source: SOURCE, type: 'resize', height }, '*')
}

new ResizeObserver(reportHeight).observe(document.documentElement)

addEventListener('message', (event) => {
  if (event.source !== parent) return
  const message = event.data
  if (!message || message.source !== SOURCE || message.type !== 'render') return
  try {
    if (cleanup) cleanup()
    cleanup = null
    const payload = message.payload
    document.documentElement.dataset.theme = payload.theme === 'dark' ? 'dark' : 'light'
    const root = document.getElementById('app')
    root.replaceChildren()
    const renderer = window.DataCheetahVisualization
    if (!renderer || typeof renderer.mount !== 'function') {
      throw new Error('visualization.js must define DataCheetahVisualization.mount')
    }
    const mounted = renderer.mount({ THREE, payload, root, reportHeight })
    if (typeof mounted === 'function') {
      cleanup = mounted
    } else if (mounted && typeof mounted.unmount === 'function') {
      cleanup = () => mounted.unmount()
    }
    requestAnimationFrame(reportHeight)
  } catch (error) {
    parent.postMessage({
      source: SOURCE,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    }, '*')
  }
})

parent.postMessage({ source: SOURCE, type: 'ready' }, '*')
`

const BOOT_ERROR_REPORTER = String.raw`
(() => {
  const SOURCE = 'datacheetah-dynamic-v1'
  const send = (value) => parent.postMessage({
    source: SOURCE,
    type: 'error',
    message: value instanceof Error ? value.message : String(value),
  }, '*')
  addEventListener('error', (event) => send(event.error || event.message || 'Visualization failed'))
  addEventListener('unhandledrejection', (event) => send(event.reason || 'Visualization failed'))
})()
`

const HOST_STYLES = String.raw`
:root {
  color-scheme: light;
  --bg: #f8fafc; --card: #fff; --text: #0f172a; --muted: #64748b;
  --border: #e2e8f0; --accent: #f2a01f; --accent2: #2563eb;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0b1220; --card: #111a2b; --text: #e8edf5; --muted: #94a3b8;
  --border: #25324a; --accent: #f8b84e; --accent2: #60a5fa;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font: 13px Inter, system-ui, sans-serif; }
body { padding: 12px; box-sizing: border-box; overflow: auto; overscroll-behavior: contain; }
#app { min-height: 100%; height: auto; }
canvas { display: block; max-width: 100%; }
`

function createThreeHostDocument(visualizationJs?: string): string {
  const customRenderer = visualizationJs
    ? `<script>${escapeInlineScript(visualizationJs)}</script>`
    : ''
  const moduleSource = `
try {
const coreUrl = URL.createObjectURL(new Blob(
  [${JSON.stringify(threeCoreRuntime)}],
  { type: 'text/javascript' },
))
const moduleSource = ${JSON.stringify(threeModuleRuntime)}
  .replaceAll('./three.core.min.js', coreUrl)
  .replaceAll('./three.core.js', coreUrl)
const moduleUrl = URL.createObjectURL(new Blob(
  [moduleSource],
  { type: 'text/javascript' },
))
const THREE = await import(moduleUrl)
URL.revokeObjectURL(moduleUrl)
URL.revokeObjectURL(coreUrl)
${HOST_MODULE}
} catch (error) {
  parent.postMessage({
    source: 'datacheetah-dynamic-v1',
    type: 'error',
    message: error instanceof Error ? error.message : String(error),
  }, '*')
}
`
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'">
  <style>${HOST_STYLES}</style>
</head>
<body>
  <div id="app"></div>
  <script>${escapeInlineScript(BOOT_ERROR_REPORTER)}</script>
  ${customRenderer}
  <script type="module">${escapeInlineScript(moduleSource)}</script>
</body>
</html>`
}

const hostDocumentCache = new Map<string, string>()

function cachedThreeHostDocument(visualizationJs?: string): string {
  const key = visualizationJs ?? ''
  const cached = hostDocumentCache.get(key)
  if (cached) return cached
  const document = createThreeHostDocument(visualizationJs)
  if (hostDocumentCache.size >= 4) {
    hostDocumentCache.delete(hostDocumentCache.keys().next().value ?? '')
  }
  hostDocumentCache.set(key, document)
  return document
}

function jsonSafeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return JSON.parse(JSON.stringify(rows, (_, value) => {
    if (typeof value === 'bigint') return Number(value)
    if (value instanceof Date) return value.toISOString()
    return value
  })) as Record<string, unknown>[]
}

export function DynamicVisualizationFrame({
  payload,
  visualizationJs,
  trusted = false,
}: {
  payload: DynamicVisualizationPayload
  visualizationJs?: string
  trusted?: boolean
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const bootTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [height, setHeight] = useState(720)
  const [reloadToken, setReloadToken] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const hostDocument = useMemo(
    () => cachedThreeHostDocument(visualizationJs),
    [visualizationJs],
  )
  const safePayload = useMemo<DynamicVisualizationPayload>(() => ({
    ...payload,
    rows: jsonSafeRows(payload.rows),
  }), [payload])

  const sendPayload = useCallback(() => {
    const frame = frameRef.current?.contentWindow
    if (!frame) return
    if (dynamicPayloadSize(safePayload) > MAX_DYNAMIC_PAYLOAD_BYTES) {
      setError('Visualization payload is too large (2 MB maximum)')
      return
    }
    const message: DynamicRenderMessage = {
      source: DYNAMIC_MESSAGE_SOURCE,
      type: 'render',
      payload: safePayload,
    }
    frame.postMessage(message, '*')
  }, [safePayload])

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = async () => {
    const shell = shellRef.current
    if (!shell) return
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen()
      } else {
        await shell.requestFullscreen()
      }
    } catch {
      // Fullscreen may be blocked by the browser; keep inline view.
    }
  }

  useEffect(() => {
    setReady(false)
    setError(null)
    if (bootTimeoutRef.current) clearTimeout(bootTimeoutRef.current)
    bootTimeoutRef.current = setTimeout(() => {
      setError('Three.js took too long to start. Check WebGL support and try again.')
    }, 10_000)
    return () => {
      if (bootTimeoutRef.current) clearTimeout(bootTimeoutRef.current)
    }
  }, [hostDocument, reloadToken])

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== frameRef.current?.contentWindow || !isDynamicHostMessage(event.data)) return
      if (event.data.type === 'ready') {
        if (bootTimeoutRef.current) clearTimeout(bootTimeoutRef.current)
        setReady(true)
        setError(null)
      } else if (event.data.type === 'resize') {
        if (document.fullscreenElement !== shellRef.current) {
          setHeight(Math.max(420, Math.min(12000, Math.ceil(event.data.height))))
        }
      } else {
        if (bootTimeoutRef.current) clearTimeout(bootTimeoutRef.current)
        setError(event.data.message)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sendPayload])

  useEffect(() => {
    if (ready) sendPayload()
  }, [ready, sendPayload])

  useEffect(() => {
    if (!isFullscreen) return
    const timer = window.setTimeout(() => {
      try {
        frameRef.current?.contentWindow?.dispatchEvent(new Event('resize'))
      } catch {
        // ignore cross-frame noise
      }
    }, 50)
    return () => window.clearTimeout(timer)
  }, [isFullscreen])

  return (
    <div
      ref={shellRef}
      className={cn(
        'discover-viz-shell relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-muted/20',
        isFullscreen
          ? 'h-full min-h-0 discover-viz-shell--fullscreen'
          : 'min-h-[min(70vh,40rem)]',
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-3 py-2">
        <span className="truncate text-xs font-medium">{payload.title}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
            <Box className="h-3 w-3" aria-hidden />
            {trusted ? 'Verified DataCheetah Three.js' : 'Sandboxed third-party Three.js'}
          </span>
          <button
            type="button"
            className="discover-viz-fullscreen-btn"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full screen'}</span>
          </button>
        </div>
      </div>
      {!ready && !error && (
        <div className="absolute inset-10 z-10 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="m-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <span>{error}</span>
          <button
            type="button"
            className="shrink-0 rounded-md border border-destructive/30 px-2 py-1 font-medium hover:bg-destructive/10"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      <iframe
        key={reloadToken}
        ref={frameRef}
        title={payload.title}
        sandbox="allow-scripts"
        srcDoc={hostDocument}
        className={cn(
          error ? 'hidden' : 'block w-full border-0 bg-transparent',
          isFullscreen ? 'min-h-0 flex-1 discover-viz-frame--fullscreen' : 'shrink-0',
        )}
        style={
          isFullscreen
            ? { height: '100%', minHeight: 0 }
            : { height: Math.max(height, 520), minHeight: 520 }
        }
      />
    </div>
  )
}
