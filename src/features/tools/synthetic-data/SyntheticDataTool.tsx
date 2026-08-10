import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Database, Download, Sparkles, Wand2 } from 'lucide-react'
import {
  ToolPane,
  ToolTextarea,
  ToolActionButton,
  ToolEmptyState,
  sizeWarning,
} from '../components/ToolPane'
import { inferPlanFromSample } from './inferFromSample'
import { generateSyntheticRows, parseEmailProviders } from './generateSynthetic'
import { downloadText, rowsToCsv, rowsToFile, rowsToJson, streamPlanToCsv } from './exportSynthetic'
import { seedPlanWithLlm } from './llmSeedService'
import {
  applyColumnRules,
  formatColumnConstraints,
  parseColumnRules,
  planFromColumnRules,
} from './columnRules'
import type { SchemaPlan } from './schemaPlan'
import { getAskLlmProvider, getActiveAskModelId, resetAskLlmSession } from '@/features/ask/services/llmSession'
import { checkWebGpuSupport, probeWebGpu, resetWebGpuProbeCache } from '@/features/ask/llm/nullProvider'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { ASK_PROVIDER_LABELS, type AskProviderId } from '@/types/askSettings'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { importFile } from '@/features/files/services/fileImportService'
import { useFilesStore } from '@/features/files/store/filesStore'
import { useSqlStore } from '@/features/sql/store/sqlStore'
import { buildDefaultQuery } from '@/features/profiling/services/profilingService'
import { ensureDuckDB } from '@/hooks/useDuckDB'
import { playSuccess } from '@/lib/audio/uiSounds'
import { cn } from '@/lib/utils/cn'

const SAMPLE_PLACEHOLDER = `order_id,customer_email,quantity,order_date
1001,john@example.com,2,2026-06-01
1002,sarah@example.com,1,2026-06-02`

const RULES_PLACEHOLDER = `order_id: integer, unique, not null, from 1000, to 9999
quantity: integer, not null, from 1, to 20
price: number, from 0.5, to 99.99
order_date: date, from 2020-01-01, to 2026-12-31
customer_email: string, unique, not null`

const DEFAULT_CONTEXT =
  'E-commerce orders for a small bookstore. Keep emails realistic and avoid example.com as email.'


const IN_MEMORY_ROW_LIMIT = 50_000
const MAX_ROW_LIMIT = 50_000_000
const LARGE_PREVIEW_ROWS = 50

/** Turn raw WebGPU / API errors into short actionable copy for the toast. */
function friendlyLlmSeedError(err: unknown, askProvider: AskProviderId): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (
    /DXGI_ERROR_DEVICE_REMOVED|requestDevice|WebGPU|GPUAdapter|D3D12|CreateMLCEngine/i.test(msg)
  ) {
    return askProvider === 'local'
      ? 'Local WebGPU/GPU failed. Continuing with sample + faker. For LLM seeds, choose OpenRouter in Settings, or turn off “Use LLM for seed rows”.'
      : 'Model backend failed. Continuing with sample + faker.'
  }
  if (/API key missing|OpenRouter/i.test(msg)) {
    return 'OpenRouter API key missing. Continuing with sample + faker. Add a key in Settings or turn off LLM seeding.'
  }
  // Cap length so Dawn stack noise never fills the toast
  const short = msg.replace(/\s+/g, ' ').trim()
  return short.length > 160 ? `${short.slice(0, 157)}…` : short
}

export function SyntheticDataTool() {
  const askProvider = usePreferencesStore((s) => s.askProvider)
  const openrouterApiKey = usePreferencesStore((s) => s.openrouterApiKey)
  const remoteKeyReady = Boolean(openrouterApiKey?.trim())
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const addFile = useFilesStore((s) => s.addFile)
  const setEditorContent = useSqlStore((s) => s.setEditorContent)

  const [sample, setSample] = useState(SAMPLE_PLACEHOLDER)
  const [columnRulesText, setColumnRulesText] = useState(RULES_PLACEHOLDER)
  const [context, setContext] = useState(DEFAULT_CONTEXT)
  const [targetRows, setTargetRows] = useState(100)
  const [generatedTargetRows, setGeneratedTargetRows] = useState<number | null>(null)
  const [seedCount, setSeedCount] = useState(10)
  const [emailDomains, setEmailDomains] = useState('gmail.com')
  const [activeEmailProviders, setActiveEmailProviders] = useState<string[]>(() =>
    parseEmailProviders('gmail.com'),
  )
  const [useLlm, setUseLlm] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [plan, setPlan] = useState<SchemaPlan | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [gpuProbe, setGpuProbe] = useState<'idle' | 'ok' | 'failed'>('idle')
  const [gpuProbeReason, setGpuProbeReason] = useState<string | null>(null)
  const [llmProgress, setLlmProgress] = useState<{ text: string; progress: number } | null>(null)

  useEffect(() => {
    if (askProvider !== 'local' || !useLlm) {
      if (askProvider !== 'local') {
        setGpuProbe('idle')
        setGpuProbeReason(null)
      }
      return
    }
    let cancelled = false
    void probeWebGpu().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setGpuProbe('ok')
        setGpuProbeReason(null)
      } else {
        setGpuProbe('failed')
        setGpuProbeReason(result.reason)
        setUseLlm(false)
        toast.warning(
          `Local model unavailable — LLM seed turned off. ${result.reason}`,
          { duration: 10_000 },
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [askProvider, useLlm])

  const previewRows = useMemo(() => rows.slice(0, 50), [rows])
  const columns = plan?.columns.map((c) => c.name) ?? (previewRows[0] ? Object.keys(previewRows[0]) : [])

  /** Warnings only when LLM seed is on and something actually blocks it — or GPU already failed. */
  const llmReadyHint = (() => {
    if (askProvider === 'local' && gpuProbe === 'failed' && gpuProbeReason) {
      return gpuProbeReason
    }
    if (!useLlm) return null
    if (askProvider === 'local') {
      const gpu = checkWebGpuSupport()
      if (!gpu.ok) {
        return `${gpu.reason} Turn off “Use LLM for seed rows”, or pick a remote model in Settings.`
      }
      return null
    }
    if (!remoteKeyReady) {
      return 'Add an OpenRouter API key in Settings to seed with a remote model, or disable LLM seeding.'
    }
    return null
  })()

  const runGenerate = async () => {
    setBusy(true)
    setError(null)
    setStatus(null)
    setLlmProgress(null)
    try {
      const seedN = Math.min(20, Math.max(3, seedCount))
      const target = Math.min(MAX_ROW_LIMIT, Math.max(1, Math.floor(targetRows)))
      const rules = parseColumnRules(columnRulesText)
      const hasSample = sample.trim().length > 0
      if (!hasSample && rules.length === 0) {
        throw new Error('Paste a sample and/or column rules (name + unique / not null).')
      }

      const buildFallbackPlan = (): SchemaPlan => {
        if (hasSample) return applyColumnRules(inferPlanFromSample(sample, seedN), rules)
        return planFromColumnRules(rules)
      }

      const emailProviders = parseEmailProviders(emailDomains)
      setActiveEmailProviders(emailProviders)
      const llmContext =
        emailProviders.length > 0
          ? `${context.trim()}\n\nEmails must use only these domains: ${emailProviders.join(', ')}.`
          : context

      let nextPlan: SchemaPlan
      let llmFallbackReason: string | null = null
      if (useLlm) {
        setStatus('Seeding first rows with LLM…')
        try {
          if (askProvider === 'local') {
            const probed = await probeWebGpu()
            if (!probed.ok) {
              setGpuProbe('failed')
              setGpuProbeReason(probed.reason)
              throw new Error(probed.reason)
            }
            setGpuProbe('ok')
          } else if (!remoteKeyReady) {
            throw new Error('Paste an OpenRouter API key in Settings before remote LLM seeding.')
          }

          await resetAskLlmSession()
          const provider = getAskLlmProvider()
          if (!provider.isReady()) {
            setLlmProgress({ text: 'Loading model…', progress: 0.02 })
            await provider.load(getActiveAskModelId(), (p) => {
              setLlmProgress({ text: p.text, progress: p.progress })
            })
          }
          nextPlan = await seedPlanWithLlm(
            provider,
            sample,
            llmContext,
            seedN,
            (text, progress) => {
              setLlmProgress({ text, progress })
            },
            rules,
          )
          setLlmProgress(null)
        } catch (err) {
          if (askProvider === 'local') {
            resetWebGpuProbeCache()
          }
          setLlmProgress(null)
          llmFallbackReason = friendlyLlmSeedError(err, askProvider)
          toast.warning(`LLM seed failed — falling back to sample/rules + faker. ${llmFallbackReason}`, {
            duration: 10_000,
          })
          setError(`LLM seed failed: ${llmFallbackReason}`)
          setStatus('LLM unavailable — using sample/rules + faker.')
          nextPlan = buildFallbackPlan()
        }
      } else {
        setStatus(hasSample ? 'Inferring schema from sample…' : 'Building schema from column rules…')
        nextPlan = buildFallbackPlan()
      }

      const streamed = target > IN_MEMORY_ROW_LIMIT
      const previewTarget = streamed ? LARGE_PREVIEW_ROWS : target
      setStatus(
        streamed
          ? `Preparing a ${previewTarget}-row preview for ${target.toLocaleString()} streamed rows…`
          : `Generating ${target.toLocaleString()} rows with faker.js…`,
      )
      const generated = generateSyntheticRows(nextPlan, {
        targetRows: previewTarget,
        emailProviders,
      })
      setPlan(nextPlan)
      setRows(generated)
      setGeneratedTargetRows(target)
      setStatus(
        streamed
          ? llmFallbackReason
            ? `Preview ready (LLM seed failed). Stream CSV for ${target.toLocaleString()} rows.`
            : `Preview ready. Click Stream CSV to write ${target.toLocaleString()} rows directly to disk.`
          : llmFallbackReason
            ? `Done: ${generated.length} rows via sample/rules + faker (LLM seed failed).`
            : `Done: ${generated.length} rows (${nextPlan.source === 'llm' ? 'LLM seed' : 'sample/rules'} + faker).`,
      )
      if (!llmFallbackReason) {
        playSuccess()
        toast.success(
          streamed
            ? `Ready to stream ${target.toLocaleString()} rows`
            : `Generated ${generated.length.toLocaleString()} synthetic rows`,
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
      setLlmProgress(null)
    }
  }

  const handleDownload = async (format: 'csv' | 'json') => {
    if (rows.length === 0) return
    if (
      format === 'csv' &&
      plan &&
      generatedTargetRows != null &&
      generatedTargetRows > IN_MEMORY_ROW_LIMIT
    ) {
      setBusy(true)
      try {
        await streamPlanToCsv(
          plan,
          generatedTargetRows,
          (completed, total) => {
            const percent = Math.round((completed / total) * 100)
            setStatus(
              `Streaming ${completed.toLocaleString()} of ${total.toLocaleString()} rows (${percent}%)…`,
            )
          },
          { emailProviders: activeEmailProviders },
        )
        setStatus(`Saved ${generatedTargetRows.toLocaleString()} rows to synthetic_data.csv`)
        playSuccess()
        toast.success('Large CSV export complete')
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setStatus('Large CSV export cancelled')
        } else {
          const message = err instanceof Error ? err.message : 'Large CSV export failed'
          setError(message)
          toast.error(message)
        }
      } finally {
        setBusy(false)
      }
      return
    }
    if (format === 'csv') {
      downloadText('synthetic_data.csv', rowsToCsv(rows), 'text/csv;charset=utf-8')
    } else {
      downloadText('synthetic_data.json', rowsToJson(rows), 'application/json')
    }
    playSuccess()
    toast.success(`Downloaded synthetic_data.${format}`)
  }

  const handleOpenExplore = async () => {
    if (rows.length === 0) return
    setBusy(true)
    try {
      await ensureDuckDB()
      const file = rowsToFile(rows, 'csv', 'synthetic_data')
      const dataset = await importFile(file)
      addFile(dataset)
      setEditorContent(buildDefaultQuery(dataset.tableName))
      setAppMode('explore')
      toast.success(`Loaded ${dataset.tableName} in Explore (${dataset.rowCount.toLocaleString()} rows)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open in Explore')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPane
      title="Generate Data"
      description="Optional sample + column rules (type, unique, not null, from/to). Up to 50 million rows via streamed CSV; faker.js fills rows locally."
      error={error}
      warning={sizeWarning(sample, columnRulesText, context) ?? llmReadyHint}
      actions={
        <>
          <ToolActionButton onClick={() => void runGenerate()} disabled={busy || (!sample.trim() && !columnRulesText.trim())}>
            <Wand2 className="h-3.5 w-3.5" />
            {busy ? 'Generating…' : 'Generate'}
          </ToolActionButton>
          <ToolActionButton
            variant="outline"
            disabled={!rows.length || busy}
            onClick={() => void handleDownload('csv')}
          >
            <Download className="h-3.5 w-3.5" />
            {generatedTargetRows != null && generatedTargetRows > IN_MEMORY_ROW_LIMIT
              ? 'Stream CSV'
              : 'CSV'}
          </ToolActionButton>
          <ToolActionButton
            variant="outline"
            disabled={!rows.length || busy || (generatedTargetRows ?? 0) > IN_MEMORY_ROW_LIMIT}
            onClick={() => void handleDownload('json')}
          >
            JSON
          </ToolActionButton>
          <ToolActionButton
            variant="secondary"
            disabled={!rows.length || busy || (generatedTargetRows ?? 0) > IN_MEMORY_ROW_LIMIT}
            onClick={() => void handleOpenExplore()}
          >
            <Database className="h-3.5 w-3.5" />
            Open in Explore
          </ToolActionButton>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <label className="space-y-1 text-[11px]">
            <span className="text-muted-foreground">Rows</span>
            <input
              type="number"
              min={1}
              max={MAX_ROW_LIMIT}
              className="block h-8 w-24 rounded-md border border-input bg-background px-2 text-xs"
              value={targetRows}
              onChange={(e) => setTargetRows(Number(e.target.value) || 1)}
            />
          </label>
          <label className="space-y-1 text-[11px]">
            <span className="text-muted-foreground">LLM seed rows</span>
            <input
              type="number"
              min={3}
              max={20}
              className="block h-8 w-24 rounded-md border border-input bg-background px-2 text-xs"
              value={seedCount}
              onChange={(e) => setSeedCount(Number(e.target.value) || 10)}
              disabled={!useLlm}
            />
          </label>
          <label className="space-y-1 text-[11px]">
            <span className="text-muted-foreground">Email domains</span>
            <input
              type="text"
              className="block h-8 w-44 rounded-md border border-input bg-background px-2 text-xs"
              value={emailDomains}
              onChange={(e) => setEmailDomains(e.target.value)}
              placeholder="gmail.com"
              title="Comma-separated domains for generated emails (e.g. gmail.com, outlook.com)"
            />
          </label>
          <label className="flex items-center gap-2 pb-1 text-xs text-foreground">
            <input
              type="checkbox"
              checked={useLlm}
              disabled={askProvider === 'local' && gpuProbe === 'failed'}
              onChange={(e) => setUseLlm(e.target.checked)}
            />
            Use LLM for seed rows
          </label>
          {askProvider === 'local' && gpuProbe === 'failed' && (
            <button
              type="button"
              className="brand-link pb-1 text-[11px] font-medium underline"
              onClick={() => setAppMode('settings')}
            >
              Switch to remote model in Settings
            </button>
          )}
          <div className="ml-auto flex items-center gap-1.5 pb-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
            Provider: {ASK_PROVIDER_LABELS[askProvider]}
          </div>
        </div>

        {(status || plan || (useLlm && llmProgress)) && (
          <div className="space-y-1.5">
            {useLlm && llmProgress && busy && (
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{llmProgress.text}</span>
                  <span className="shrink-0 font-mono">
                    {Math.min(100, Math.round(llmProgress.progress * 100))}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-200"
                    style={{
                      width: `${Math.min(100, Math.max(2, Math.round(llmProgress.progress * 100)))}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {!(llmProgress && busy) && (status || plan) && (
              <p className="text-[11px] text-muted-foreground">
                {status}
                {plan && !busy && (
                  <span className="ml-2">
                    Columns:{' '}
                    {plan.columns.map((c) => formatColumnConstraints(c)).join(', ')}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        <div className="grid min-h-[480px] flex-none grid-cols-1 gap-3 lg:flex-1 lg:grid-cols-2">
          <div className="grid min-h-0 gap-3 lg:grid-rows-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.7fr)]">
            <ToolTextarea
              label="Sample (CSV or JSON)"
              tone="sky"
              placeholder={SAMPLE_PLACEHOLDER}
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              containerClassName="h-[164px] lg:h-full"
            />
            <ToolTextarea
              label="Column rules (optional — type, unique, not null, from/to)"
              tone="amber"
              placeholder={RULES_PLACEHOLDER}
              value={columnRulesText}
              onChange={(e) => setColumnRulesText(e.target.value)}
              containerClassName="h-[144px] lg:h-full"
            />
            <ToolTextarea
              label="Context"
              tone="violet"
              placeholder="Describe the domain, constraints, locale…"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              containerClassName="h-[120px] lg:h-full"
            />
          </div>

          <div className="flex min-h-[240px] flex-col gap-1.5 lg:min-h-0">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview ({previewRows.length}
              {rows.length > previewRows.length ? ` of ${rows.length}` : ''} rows)
            </span>
            <div
              className={cn(
                'min-h-0 flex-1 overflow-auto rounded-md border bg-background',
                !rows.length && 'flex items-center justify-center',
              )}
            >
              {!rows.length ? (
                <ToolEmptyState
                  icon={<Database className="h-5 w-5" />}
                  title="Preview your dataset"
                  description="Generated rows will appear here before you download or open them in Explore."
                />
              ) : (
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="border-b px-2 py-1.5 font-semibold whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="odd:bg-muted/20">
                        {columns.map((col) => (
                          <td key={col} className="border-b border-border/40 px-2 py-1 font-mono whitespace-nowrap">
                            {row[col] == null ? '' : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToolPane>
  )
}
