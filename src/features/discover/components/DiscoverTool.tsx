import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import {
  BarChart3,
  BookOpen,
  Building2,
  Compass,
  Download,
  HeartPulse,
  CircleHelp,
  LayoutDashboard,
  Loader2,
  MapPinned,
  Maximize2,
  Megaphone,
  Minimize2,
  PackagePlus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Upload,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { buildChartOption } from '@/features/charts/services/chartInferenceService'
import { ensureMapRegistered, type MapId } from '@/features/charts/services/mapRegistry'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { BUNDLED_TEMPLATES } from '../content/templateCatalog'
import type { DashboardPack } from '@/types/dashboardPack'
import { DASHBOARD_CATEGORIES, normalizeSamples } from '@/types/dashboardPack'
import { mapColumnsToRoles, type ColumnMapping } from '../services/columnMapper'
import {
  parseCsvHeaders,
  runDashboard,
  type DashboardChartResult,
  type DashboardDynamicResult,
  type DashboardMapping,
  validateMappingForRule,
} from '../services/dashboardRunner'
import {
  deleteInstalledPack,
  downloadPackZip,
  fetchBundledPack,
  listInstalledPacks,
  readPackFromZip,
  saveInstalledPack,
} from '../services/packIo'
import { cn } from '@/lib/utils/cn'
import { DISCOVER_BLURB, hasSeenDiscoverPackTip, markDiscoverPackTipSeen } from '../content/discoverCopy'
import { JsPackRiskDialog } from './JsPackRiskDialog'
import { DiscoverPackTipDialog } from './DiscoverPackTipDialog'

const ReactECharts = lazy(() => import('echarts-for-react'))
const DynamicVisualizationFrame = lazy(() =>
  import('./DynamicVisualizationFrame').then((module) => ({
    default: module.DynamicVisualizationFrame,
  })),
)

function DynamicFrameFallback() {
  return (
    <div className="grid min-h-[26rem] place-items-center rounded-xl border border-border/60 bg-muted/20">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function DiscoverChart({
  option,
  mapId,
  height = 260,
  title,
}: {
  option: Record<string, unknown>
  mapId?: MapId
  height?: number
  title?: string
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(!mapId)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!mapId) {
      setReady(true)
      return
    }
    let cancelled = false
    setReady(false)
    setMapError(null)
    void ensureMapRegistered(mapId)
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((e) => {
        if (!cancelled) setMapError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [mapId])

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

  if (mapError) return <p className="text-xs text-destructive">{mapError}</p>
  if (!ready) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />

  return (
    <div
      ref={shellRef}
      className={cn(
        'discover-viz-shell relative flex min-h-0 flex-col',
        isFullscreen && 'discover-viz-shell--fullscreen',
      )}
    >
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {title ?? 'Chart'}
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
      <Suspense fallback={<Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}>
        <ReactECharts
          option={option}
          style={{
            height: isFullscreen ? 'calc(100% - 2rem)' : height,
            width: '100%',
            minHeight: isFullscreen ? 0 : height,
            flex: isFullscreen ? 1 : undefined,
          }}
          opts={{ renderer: 'canvas' }}
          notMerge
        />
      </Suspense>
    </div>
  )
}

type View = 'browse' | 'detail' | 'dashboard'

function packPublisher(meta: { publisher?: string; author?: string }): string {
  return meta.publisher?.trim() || meta.author?.trim() || 'Unknown'
}

function packVersion(meta: { version?: string }): string {
  return meta.version?.trim() || '1.0.0'
}

function TemplateIcon({ id, category }: { id: string; category: string }) {
  const className = 'h-5 w-5'
  if (id === 'regional-census-map' || id === 'population-demographics') {
    return <MapPinned className={className} aria-hidden />
  }
  if (id === 'census-household') return <Building2 className={className} aria-hidden />
  if (id === 'workforce-diversity') return <UsersRound className={className} aria-hidden />
  if (category === 'ecommerce') return <ShoppingBag className={className} aria-hidden />
  if (category === 'finance') return <WalletCards className={className} aria-hidden />
  if (category === 'healthcare') return <HeartPulse className={className} aria-hidden />
  if (category === 'marketing') return <Megaphone className={className} aria-hidden />
  if (category === 'operations') return <Truck className={className} aria-hidden />
  return <BarChart3 className={className} aria-hidden />
}

function TemplateMetaLine({
  publisher,
  version,
  extra,
}: {
  publisher: string
  version: string
  extra?: string
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      <span>
        <span className="font-medium uppercase tracking-wide text-muted-foreground/80">Publisher</span>{' '}
        <span className="text-foreground/90">{publisher}</span>
      </span>
      <span>
        <span className="font-medium uppercase tracking-wide text-muted-foreground/80">Version</span>{' '}
        <span className="text-foreground/90">{version}</span>
      </span>
      {extra ? <span className="text-muted-foreground">{extra}</span> : null}
    </div>
  )
}

function buildSampleMapping(pack: DashboardPack): {
  mapping: DashboardMapping
  missing: string[]
  files: Record<string, File> | File
  headers: Record<string, string[]>
} {
  const samples = normalizeSamples(pack)
  if (pack.rule.tables?.length) {
    const perTable: Record<string, ColumnMapping> = {}
    const files: Record<string, File> = {}
    const headers: Record<string, string[]> = {}
    const missing: string[] = []
    for (const t of pack.rule.tables) {
      const stem = (n: string) => n.replace(/\.csv$/i, '')
      const sample =
        samples.find((s) => stem(s.name) === stem(t.file)) ??
        samples.find((s) => s.name === t.id) ??
        samples[0]
      if (!sample) {
        missing.push(...t.requiredColumns.map((c) => `${t.id}.${c.role}`))
        continue
      }
      const hdrs = parseCsvHeaders(sample.csv)
      const { mapping: map, missing: miss } = mapColumnsToRoles(hdrs, t.requiredColumns)
      perTable[t.id] = map
      headers[t.id] = hdrs
      missing.push(...miss.map((r) => `${t.id}.${r}`))
      files[t.id] = new File([sample.csv], `${t.id}.csv`, { type: 'text/csv' })
    }
    return { mapping: perTable, missing, files, headers }
  }
  const sample = samples[0]
  if (!sample) {
    return { mapping: {}, missing: ['sample'], files: new File([], 'empty.csv'), headers: {} }
  }
  const roles = pack.rule.requiredColumns ?? []
  const hdrs = parseCsvHeaders(sample.csv)
  const { mapping, missing } = mapColumnsToRoles(hdrs, roles)
  const file = new File([sample.csv], `${pack.meta.id}-sample.csv`, { type: 'text/csv' })
  return { mapping, missing, files: file, headers: { sample: hdrs } }
}

export function DiscoverTool() {
  const theme = usePreferencesStore((s) => s.theme)
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const [view, setView] = useState<View>('browse')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [installed, setInstalled] = useState<DashboardPack[]>([])
  const [active, setActive] = useState<DashboardPack | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const isMultiTable = (pack: DashboardPack | null) => (pack?.rule.tables?.length ?? 0) > 1

  const openFilePicker = (key: string) => {
    const el = fileInputRefs.current[key]
    if (el) {
      el.value = ''
      el.click()
    }
  }
  const [mapping, setMapping] = useState<DashboardMapping>({})
  const [tableHeaders, setTableHeaders] = useState<Record<string, string[]>>({})
  const [dataFiles, setDataFiles] = useState<Record<string, File>>({})
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [matchInfo, setMatchInfo] = useState<{ missing: string[] } | null>(null)
  const [chartResults, setChartResults] = useState<DashboardChartResult[] | null>(null)
  const [dynamicResult, setDynamicResult] = useState<DashboardDynamicResult | null>(null)
  const [pendingJsPack, setPendingJsPack] = useState<DashboardPack | null>(null)
  const [packTipOpen, setPackTipOpen] = useState(false)

  useEffect(() => {
    if (view !== 'browse') {
      setPackTipOpen(false)
      return
    }
    if (hasSeenDiscoverPackTip()) return
    const t = window.setTimeout(() => setPackTipOpen(true), 350)
    return () => window.clearTimeout(t)
  }, [view])

  const dismissPackTip = (open: boolean) => {
    setPackTipOpen(open)
    if (!open) markDiscoverPackTipSeen()
  }

  const themedCharts = useMemo(() => {
    if (!chartResults) return null
    const chartTheme = theme === 'dark' ? 'dark' : 'light'
    return chartResults.map((c) => {
      if (c.error) return c
      if (c.type !== 'sankey' && !c.xColumn) return c
      return {
        ...c,
        option: buildChartOption(c.result, c.type, c.xColumn, c.yColumn, chartTheme, {
          y2Column: c.y2Column,
          seriesColumn: c.seriesColumn,
          sourceColumn: c.sourceColumn,
          targetColumn: c.targetColumn,
          mapId: c.mapId,
        }),
      }
    })
  }, [chartResults, theme])

  const dynamicPayload = useMemo(() => {
    if (!dynamicResult || dynamicResult.error) return null
    return {
      visualizationId: dynamicResult.visualizationId,
      title: dynamicResult.title,
      columns: dynamicResult.columns,
      rows: dynamicResult.rows,
      settings: dynamicResult.settings,
      theme: theme === 'dark' ? 'dark' as const : 'light' as const,
    }
  }, [dynamicResult, theme])

  const refreshInstalled = async () => {
    setInstalled(await listInstalledPacks())
  }

  useEffect(() => {
    void refreshInstalled()
  }, [])

  const filteredBundled = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return BUNDLED_TEMPLATES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false
      if (!needle) return true
      return `${t.name} ${t.description} ${t.category} ${t.publisher}`.toLowerCase().includes(needle)
    })
  }, [query, category])

  const filteredInstalled = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return installed.filter((p) => {
      if (category !== 'all' && p.meta.category !== category) return false
      if (!needle) return true
      return `${p.meta.name} ${p.meta.description} ${p.meta.category} ${packPublisher(p.meta)}`.toLowerCase().includes(needle)
    })
  }, [installed, query, category])

  const openDashboardWithSample = async (pack: DashboardPack) => {
    setActive(pack)
    setChartResults(null)
    setDynamicResult(null)
    const samples = normalizeSamples(pack)
    if (!samples.length) {
      setCsvFile(null)
      setDataFiles({})
      setTableHeaders({})
      setMapping({})
      setMatchInfo(null)
      setView('detail')
      toast.message('No sample data — bring your own data to open charts')
      return
    }
    const { mapping: map, missing, files, headers: hdrs } = buildSampleMapping(pack)
    setMapping(map)
    setMatchInfo({ missing })
    setTableHeaders(hdrs)
    if (files instanceof File) {
      setCsvFile(files)
      setDataFiles({})
    } else {
      setCsvFile(null)
      setDataFiles(files)
    }
    if (missing.length) {
      setView('detail')
      toast.message('Sample needs field matching — adjust below, then visualize my data')
      return
    }
    try {
      const { charts, dynamic } = await runDashboard(pack, files, map)
      setChartResults(charts)
      setDynamicResult(dynamic ?? null)
      setView('dashboard')
      toast.success(
        pack.rule.renderer === 'dynamic'
          ? 'Interactive sample ready'
          : `Sample dashboard ready · ${charts.length} charts`,
      )
    } catch (err) {
      setView('detail')
      toast.error(err instanceof Error ? err.message : 'Dashboard failed')
    }
  }

  const openBundled = async (id: string, basePath: string) => {
    setLoadingTemplateId(id)
    setBusy(true)
    try {
      const pack = await fetchBundledPack(basePath)
      await openDashboardWithSample(pack)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load template')
    } finally {
      setBusy(false)
      setLoadingTemplateId(null)
    }
  }

  const openInstalled = (pack: DashboardPack) => {
    void (async () => {
      setBusy(true)
      try {
        await openDashboardWithSample(pack)
      } finally {
        setBusy(false)
      }
    })()
  }

  const useSample = () => {
    if (!active || !normalizeSamples(active).length) {
      toast.message('This template has no sample data')
      return
    }
    void (async () => {
      setBusy(true)
      try {
        await openDashboardWithSample(active)
      } finally {
        setBusy(false)
      }
    })()
  }

  const findSampleForTable = (tableId: string, tableFile?: string) => {
    if (!active) return undefined
    const samples = normalizeSamples(active)
    if (!samples.length) return undefined
    const want = (tableFile ?? tableId).replace(/\.csv$/i, '').toLowerCase()
    return (
      samples.find((s) => s.name.replace(/\.csv$/i, '').toLowerCase() === want) ??
      samples.find((s) => s.name.replace(/\.csv$/i, '').toLowerCase() === tableId.toLowerCase()) ??
      samples.find((s) => s.name === tableId) ??
      (samples.length === 1 ? samples[0] : undefined)
    )
  }

  const downloadSampleCsv = (tableId: string, tableFile?: string) => {
    if (!active) return
    const sample = findSampleForTable(tableId, tableFile)
    if (!sample) {
      toast.message(`No sample file for “${tableId}”`)
      return
    }
    const blob = new Blob([sample.csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tableId}-sample.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onUploadForTable = async (
    tableId: string,
    file: File | undefined,
    opts?: { silent?: boolean },
  ) => {
    if (!file || !active) return
    const text = await file.text()
    const hdrs = parseCsvHeaders(text)
    const table = active.rule.tables?.find((t) => t.id === tableId)
    const roles = table?.requiredColumns ?? active.rule.requiredColumns ?? []
    const { mapping: map, missing } = mapColumnsToRoles(hdrs, roles)
    setTableHeaders((h) => ({ ...h, [tableId]: hdrs }))
    setDataFiles((f) => ({ ...f, [tableId]: file }))
    if (active.rule.tables?.length) {
      setMapping((prev) => {
        const next = {
          ...(prev as Record<string, ColumnMapping>),
          [tableId]: map,
        }
        const allMissing: string[] = []
        for (const t of active.rule.tables ?? []) {
          const m = next[t.id]
          if (!m) {
            allMissing.push(...t.requiredColumns.map((c) => `${t.id}.${c.role}`))
            continue
          }
          for (const c of t.requiredColumns) {
            if (!m[c.role]) allMissing.push(`${t.id}.${c.role}`)
          }
        }
        setMatchInfo({ missing: allMissing })
        return next
      })
    } else {
      setMapping(map)
      setCsvFile(file)
      setMatchInfo({ missing })
    }
    if (!opts?.silent) toast.success(`Loaded ${file.name}`)
  }

  const onUploadCsv = async (file: File | undefined) => {
    if (!file || !active) return
    if (active.rule.tables && active.rule.tables.length > 1) {
      toast.message('This template needs one file per table — use the slots below')
      return
    }
    const tableId = active.rule.tables?.[0]?.id ?? 'sample'
    await onUploadForTable(tableId, file)
  }

  const run = async () => {
    if (!active) return
    const multi = isMultiTable(active) || Boolean(active.rule.tables?.length)
    const files = multi && active.rule.tables?.length
      ? dataFiles
      : csvFile ?? dataFiles[active.rule.tables?.[0]?.id ?? 'sample']
    if (!files || (typeof files === 'object' && !(files instanceof File) && !Object.keys(files).length)) {
      toast.error('Bring your own data first')
      return
    }
    if (active.rule.tables && active.rule.tables.length > 1) {
      const missingTables = active.rule.tables.filter((t) => !dataFiles[t.id]).map((t) => t.id)
      if (missingTables.length) {
        toast.error(`Add a file for: ${missingTables.join(', ')}`)
        return
      }
    }
    const errors = validateMappingForRule(active.rule, mapping)
    if (errors.length) {
      toast.error(errors[0])
      return
    }
    setBusy(true)
    try {
      const { charts, dynamic } = await runDashboard(active, files, mapping)
      setChartResults(charts)
      setDynamicResult(dynamic ?? null)
      setView('dashboard')
      toast.success(
        active.rule.renderer === 'dynamic'
          ? 'Interactive visualization ready'
          : `Visualized ${charts.length} charts`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dashboard failed')
    } finally {
      setBusy(false)
    }
  }

  const setRoleMapping = (tableId: string, role: string, header: string) => {
    if (active?.rule.tables?.length) {
      setMapping((prev) => {
        const cur = { ...(prev as Record<string, ColumnMapping>) }
        cur[tableId] = { ...(cur[tableId] ?? {}), [role]: header }
        return cur
      })
    } else {
      setMapping((prev) => ({ ...(prev as ColumnMapping), [role]: header }))
    }
  }

  const roleValue = (tableId: string, role: string) => {
    if (active?.rule.tables?.length) {
      return (mapping as Record<string, ColumnMapping>)[tableId]?.[role] ?? ''
    }
    return (mapping as ColumnMapping)[role] ?? ''
  }

  const finishInstall = async (pack: DashboardPack) => {
    setBusy(true)
    try {
      await saveInstalledPack(pack)
      await refreshInstalled()
      toast.success(`Installed “${pack.meta.name}”`)
      await openDashboardWithSample(pack)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Install failed')
    } finally {
      setBusy(false)
    }
  }

  const installZip = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const pack = await readPackFromZip(file)
      if (pack.visualizationJs) {
        setPendingJsPack(pack)
        setBusy(false)
        return
      }
      await finishInstall(pack)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid template')
      setBusy(false)
    }
  }

  const riskDialog = (
    <JsPackRiskDialog
      open={Boolean(pendingJsPack)}
      pack={
        pendingJsPack
          ? {
              name: pendingJsPack.meta.name,
              publisher: packPublisher(pendingJsPack.meta),
              version: packVersion(pendingJsPack.meta),
            }
          : null
      }
      onOpenChange={(open) => {
        if (!open) setPendingJsPack(null)
      }}
      onConfirm={() => {
        const pack = pendingJsPack
        setPendingJsPack(null)
        if (pack) void finishInstall(pack)
      }}
    />
  )

  const packTipDialog = (
    <DiscoverPackTipDialog
      open={packTipOpen}
      onOpenChange={dismissPackTip}
      onOpenDevelopers={() => setAppMode('template-design')}
    />
  )

  const exportActive = async () => {
    if (!active) return
    try {
      await downloadPackZip(active)
      toast.success('Template exported')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  if (view === 'dashboard' && active && (themedCharts || dynamicResult)) {
    const insights = active.meta.insights ?? []
    const isSampleDashboard =
      Object.values(dataFiles).some((file) => file.name.includes('-sample')) ||
      Boolean(csvFile?.name.includes('-sample.csv'))
    return (
      <>
        {riskDialog}
      <div
        className={cn(
          'discover-dashboard-shell flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4',
          `discover-category-tag--${active.meta.category}`,
        )}
      >
        <header className="discover-dashboard-header">
          <Button
            size="sm"
            variant="outline"
            className="discover-dashboard-back"
            onClick={() => setView('browse')}
          >
            Back
          </Button>
          <span className="discover-template-icon discover-dashboard-icon">
            <TemplateIcon id={active.meta.id} category={active.meta.category} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold tracking-tight">{active.meta.name}</h2>
              <span className={cn('discover-category-tag capitalize', `discover-category-tag--${active.meta.category}`)}>
                {active.meta.category}
              </span>
              {active.rule.renderer === 'dynamic' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  {active.visualizationJs && active.source === 'installed'
                    ? 'Sandboxed Three.js pack'
                    : 'Interactive JavaScript'}
                </span>
              )}
            </div>
            <div className="discover-dashboard-meta">
              <span>
                Publisher <strong>{packPublisher(active.meta)}</strong>
              </span>
              <span>
                Version <strong>{packVersion(active.meta)}</strong>
              </span>
            </div>
            <span className="discover-dashboard-status">
              <span className="discover-dashboard-status-dot" aria-hidden />
              {isSampleDashboard ? 'Sample dashboard' : 'Your dashboard'}
            </span>
          </div>
          <div className="discover-dashboard-actions">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={() => setView('detail')}
            >
              <Upload className="h-3.5 w-3.5" />
              Bring your own data
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void exportActive()}>
              <Download className="h-3.5 w-3.5" />
              Export template
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
          {insights.length > 0 && (
            <section className="discover-dashboard-insights">
              <div className="discover-dashboard-insights-head">
                <span className="discover-dashboard-insights-icon">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div>
                  <p className="discover-dashboard-insights-title">What you can visualize</p>
                  <p className="discover-dashboard-insights-sub">
                    {insights.length} takeaway{insights.length === 1 ? '' : 's'} from this template
                  </p>
                </div>
              </div>
              <ul className="discover-dashboard-insights-grid">
                {insights.map((line, index) => {
                  const [title, ...rest] = line.split(' — ')
                  const detail = rest.join(' — ').trim()
                  return (
                    <li key={line} className="discover-dashboard-insight">
                      <span className="discover-dashboard-insight-index">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="discover-dashboard-insight-title">{title}</p>
                        {detail ? (
                          <p className="discover-dashboard-insight-detail">{detail}</p>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {active.rule.renderer === 'dynamic' ? (
            dynamicResult?.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {dynamicResult.error}
              </div>
            ) : dynamicPayload ? (
              <div className="min-h-[min(70vh,40rem)] flex-1">
                <Suspense fallback={<DynamicFrameFallback />}>
                  <DynamicVisualizationFrame
                    payload={dynamicPayload}
                    visualizationJs={active.visualizationJs}
                    trusted={active.source === 'bundled'}
                  />
                </Suspense>
              </div>
            ) : (
              <div className="grid min-h-[20rem] place-items-center text-sm text-muted-foreground">
                Preparing interactive visualization…
              </div>
            )
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(themedCharts ?? []).map((c) => (
                <article key={c.title} className="discover-dashboard-chart">
                  <div className="discover-dashboard-chart-head">
                    <span className="discover-dashboard-chart-icon">
                      <BarChart3 className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{c.title}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">Interactive visualization</p>
                    </div>
                    <span className="discover-dashboard-chart-type">{c.type.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="discover-dashboard-chart-body">
                    {c.error ? (
                      <p className="text-xs text-destructive">{c.error}</p>
                    ) : c.option ? (
                      <DiscoverChart option={c.option} mapId={c.mapId} title={c.title} />
                    ) : (
                      <p className="text-xs text-muted-foreground">No chart for this result</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
    )
  }

  if (view === 'detail' && active) {
    const insights = active.meta.insights ?? []
    return (
      <>
        {riskDialog}
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
        <div className="flex flex-wrap items-start gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setView(themedCharts ? 'dashboard' : 'browse')}
          >
            Back
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{active.meta.name}</h2>
            <p className="text-xs text-muted-foreground">{active.meta.description}</p>
            <TemplateMetaLine
              publisher={packPublisher(active.meta)}
              version={packVersion(active.meta)}
              extra={
                active.rule.renderer === 'dynamic'
                  ? `${active.meta.category} · interactive Three.js`
                  : `${active.meta.category} · ${active.rule.charts.length} charts`
              }
            />
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void exportActive()}>
            <Download className="h-3.5 w-3.5" />
            Export template
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <aside className="relative z-20 flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain">
            {insights.length > 0 && (
              <section className="discover-dashboard-insights discover-dashboard-insights--stack">
                <div className="discover-dashboard-insights-head">
                  <span className="discover-dashboard-insights-icon">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div>
                    <p className="discover-dashboard-insights-title">What you can visualize</p>
                    <p className="discover-dashboard-insights-sub">
                      {insights.length} takeaway{insights.length === 1 ? '' : 's'} from this template
                    </p>
                  </div>
                </div>
                <ul className="discover-dashboard-insights-grid">
                  {insights.map((line, index) => {
                    const [title, ...rest] = line.split(' — ')
                    const detail = rest.join(' — ').trim()
                    return (
                      <li key={line} className="discover-dashboard-insight">
                        <span className="discover-dashboard-insight-index">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="discover-dashboard-insight-title">{title}</p>
                          {detail ? (
                            <p className="discover-dashboard-insight-detail">{detail}</p>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <section className="rounded-lg border border-border/60 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Fields this template needs
              </p>
              {active.rule.tables?.length ? (
                <div className="mt-2 space-y-3">
                  {active.rule.tables.map((t) => (
                    <div key={t.id}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--brand)]">
                        {t.id}
                      </p>
                      <ul className="mt-1 space-y-1 text-xs">
                        {t.requiredColumns.map((c) => (
                          <li key={c.role}>
                            <span className="font-mono text-foreground">{c.role}</span>
                            <span className="text-muted-foreground">
                              {' '}
                              — also matches: {c.aliases.join(', ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {active.rule.joins?.length ? (
                    <p className="text-[10px] text-muted-foreground">
                      Joins:{' '}
                      {active.rule.joins
                        .map((j) => `${j.left}.${j.on[0]} = ${j.right}.${j.on[1]}`)
                        .join(' · ')}
                    </p>
                  ) : null}
                </div>
              ) : (
                <ul className="mt-2 space-y-1 text-xs">
                  {(active.rule.requiredColumns ?? []).map((c) => (
                    <li key={c.role}>
                      <span className="font-mono text-foreground">{c.role}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        — also matches: {c.aliases.join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="relative z-20 space-y-2 rounded-lg border border-border/60 bg-background p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Your data
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={useSample}
                >
                  Use sample data
                </Button>
                {!isMultiTable(active) && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={busy}
                      onClick={() => openFilePicker('single')}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Choose file
                    </Button>
                    <input
                      ref={(el) => {
                        fileInputRefs.current.single = el
                      }}
                      type="file"
                      accept=".csv,text/csv"
                      className="pointer-events-none absolute h-px w-px opacity-0"
                      tabIndex={-1}
                      aria-hidden
                      onChange={(e) => void onUploadCsv(e.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={busy}
                      onClick={() => {
                        const id = active.rule.tables?.[0]?.id ?? 'sample'
                        const file = active.rule.tables?.[0]?.file
                        downloadSampleCsv(id, file)
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download sample
                    </Button>
                  </>
                )}
              </div>

              {isMultiTable(active) && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] text-muted-foreground">
                    Use sample data runs the full template. For your own data, upload one CSV per
                    table (download a sample to see the expected shape).
                  </p>
                  {active.rule.tables!.map((t) => (
                    <div key={t.id} className="rounded-md border border-border/50 bg-background p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-medium">{t.id}</span>
                        <div className="relative z-10 flex flex-wrap items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[11px]"
                            disabled={busy}
                            onClick={() => downloadSampleCsv(t.id, t.file)}
                            title={`Download ${t.id}-sample.csv`}
                          >
                            <Download className="h-3 w-3" />
                            Sample
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[11px]"
                            disabled={busy}
                            onClick={() => openFilePicker(t.id)}
                          >
                            <Upload className="h-3 w-3" />
                            {dataFiles[t.id] ? 'Replace' : 'Choose file'}
                          </Button>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[t.id] = el
                            }}
                            type="file"
                            accept=".csv,text/csv"
                            className="pointer-events-none absolute h-px w-px opacity-0"
                            tabIndex={-1}
                            aria-hidden
                            onChange={(e) => void onUploadForTable(t.id, e.target.files?.[0])}
                          />
                        </div>
                      </div>
                      {dataFiles[t.id] && (
                        <p className="mt-1 text-[10px] text-muted-foreground font-mono">
                          {dataFiles[t.id].name}
                        </p>
                      )}
                      {(tableHeaders[t.id]?.length ?? 0) > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {t.requiredColumns.map((role) => (
                            <label key={role.role} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="w-24 font-mono text-muted-foreground">{role.role}</span>
                              <select
                                className="page-field h-8 min-w-[8rem] flex-1"
                                value={roleValue(t.id, role.role)}
                                onChange={(e) => setRoleMapping(t.id, role.role, e.target.value)}
                              >
                                <option value="">— choose field —</option>
                                {tableHeaders[t.id].map((h) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(csvFile || dataFiles[active.rule.tables?.[0]?.id ?? 'sample']) && (
                <p className="text-[11px] text-muted-foreground">
                  {matchInfo && matchInfo.missing.length === 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Ready — your file matches this template
                    </span>
                  )}
                  {matchInfo && matchInfo.missing.length > 0 && (
                    <span className="text-amber-700 dark:text-amber-300">
                      Needs matching: {matchInfo.missing.join(', ')}
                    </span>
                  )}
                </p>
              )}

              {!active.rule.tables?.length && (tableHeaders.sample?.length ?? 0) > 0 && (
                <div className="mt-2 space-y-2">
                  {(active.rule.requiredColumns ?? []).map((role) => (
                    <label key={role.role} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="w-28 font-mono text-muted-foreground">{role.role}</span>
                      <select
                        className="page-field h-8 min-w-[10rem] flex-1"
                        value={roleValue('sample', role.role)}
                        onChange={(e) => setRoleMapping('sample', role.role, e.target.value)}
                      >
                        <option value="">— choose field —</option>
                        {tableHeaders.sample.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              {active.rule.tables?.length === 1 &&
                (tableHeaders[active.rule.tables[0].id]?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-2">
                    {active.rule.tables[0].requiredColumns.map((role) => (
                      <label key={role.role} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="w-28 font-mono text-muted-foreground">{role.role}</span>
                        <select
                          className="page-field h-8 min-w-[10rem] flex-1"
                          value={roleValue(active.rule.tables![0].id, role.role)}
                          onChange={(e) =>
                            setRoleMapping(active.rule.tables![0].id, role.role, e.target.value)
                          }
                        >
                          <option value="">— choose field —</option>
                          {tableHeaders[active.rule.tables?.[0]?.id ?? '']?.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}

              <Button
                size="sm"
                className="mt-1 gap-1.5"
                disabled={
                  busy ||
                  (!csvFile && !Object.keys(dataFiles).length)
                }
                onClick={() => void run()}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LayoutDashboard className="h-3.5 w-3.5" />}
                Visualize my data
              </Button>
            </section>
          </aside>

          <section className="relative z-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-background/60">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Visualizations
              </p>
              <span className="text-[10px] text-muted-foreground">
                {themedCharts
                  ? Object.values(dataFiles).some((f) => f.name.includes('-sample')) ||
                    csvFile?.name.includes('-sample')
                    ? 'Showing sample'
                    : 'Showing your data'
                  : 'Charts appear here'}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {active.rule.renderer === 'dynamic' && dynamicResult ? (
                dynamicResult.error ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {dynamicResult.error}
                  </p>
                ) : dynamicPayload ? (
                  <Suspense fallback={<DynamicFrameFallback />}>
                    <DynamicVisualizationFrame
                      payload={dynamicPayload}
                      visualizationJs={active.visualizationJs}
                      trusted={active.source === 'bundled'}
                    />
                  </Suspense>
                ) : null
              ) : themedCharts ? (
                <div className="grid gap-3 sm:grid-cols-1 xl:grid-cols-2">
                  {themedCharts.map((c) => (
                    <div key={c.title} className="rounded-lg border border-border/60 bg-background p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">{c.title}</p>
                        <span className="text-[10px] uppercase text-muted-foreground">{c.type}</span>
                      </div>
                      {c.error ? (
                        <p className="text-xs text-destructive">{c.error}</p>
                      ) : c.option ? (
                        <DiscoverChart option={c.option} mapId={c.mapId} height={220} title={c.title} />
                      ) : (
                        <p className="text-xs text-muted-foreground">No chart for this result</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 px-4 text-center">
                  <LayoutDashboard className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">Charts stay here while you map fields</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Choose a file, match the fields, then click Visualize my data.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      </>
    )
  }

  return (
    <>
      {riskDialog}
      {packTipDialog}
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="page-heading-icon">
          <Compass className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Discover</h1>
          <p className="mt-1 text-sm font-medium text-foreground">{DISCOVER_BLURB}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick a free template to open a sample dashboard and see what you can visualize. Then bring
            your own data anytime — everything stays on your device.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            title="About installing and creating packs"
            aria-label="About installing and creating packs"
            onClick={() => setPackTipOpen(true)}
          >
            <CircleHelp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setAppMode('template-design')}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Dev packs
          </Button>
          <label className="inline-flex cursor-pointer">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted/50">
              <PackagePlus className="h-3.5 w-3.5" />
              Install template
            </span>
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void installZip(file)
              }}
            />
          </label>
        </div>
      </div>

      <div className="discover-search-wrap">
        <Search className="discover-search-icon" aria-hidden />
        <input
          type="search"
          className="discover-search-input"
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search templates"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DASHBOARD_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] capitalize',
              category === c
                ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-foreground'
                : 'border-border/60 text-muted-foreground hover:border-border',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <section>
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Free templates
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBundled.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={loadingTemplateId === t.id}
              onClick={() => void openBundled(t.id, t.basePath)}
              className={cn(
                'discover-template-card group',
                `discover-category-tag--${t.category}`,
              )}
            >
              <span className="discover-template-card-glow" aria-hidden />
              <div className="relative flex items-start justify-between gap-3">
                <span className="discover-template-icon">
                  {loadingTemplateId === t.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <TemplateIcon id={t.id} category={t.category} />
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className={cn('discover-category-tag capitalize', `discover-category-tag--${t.category}`)}>
                    {t.category}
                  </span>
                  <span className="discover-template-free">
                    FREE
                  </span>
                  {t.renderer === 'dynamic' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                      VERIFIED
                    </span>
                  )}
                </span>
              </div>
              <div className="relative mt-3">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {t.name}
                </h3>
                <p className="mt-1.5 min-h-8 text-[11px] leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              </div>
              {t.insights[0] && (
                <p className="discover-template-insight">
                  <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="line-clamp-2">
                    <span className="font-semibold">Visualize · </span>
                  {t.insights[0]}
                  </span>
                </p>
              )}
              <div className="discover-template-footer">
                <TemplateMetaLine
                  publisher={t.publisher}
                  version={t.version}
                  extra={t.renderer === 'dynamic' ? 'Interactive Three.js' : `${t.chartCount} charts`}
                />
                <span className="discover-template-open">
                  Open sample
                  <span aria-hidden>→</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {filteredInstalled.length > 0 && (
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            My templates
          </h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredInstalled.map((p) => (
              <div
                key={p.meta.id}
                className={cn(
                  'discover-installed-card',
                  `discover-category-tag--${p.meta.category}`,
                )}
              >
                <button type="button" className="w-full text-left" onClick={() => openInstalled(p)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <span className="discover-template-icon discover-template-icon--small">
                        <TemplateIcon id={p.meta.id} category={p.meta.category} />
                      </span>
                      <span className="text-sm font-semibold">{p.meta.name}</span>
                    </span>
                    <span
                      className={cn(
                        'discover-category-tag capitalize',
                        `discover-category-tag--${p.meta.category}`,
                      )}
                    >
                      {p.meta.category}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{p.meta.description}</p>
                  <TemplateMetaLine
                    publisher={packPublisher(p.meta)}
                    version={packVersion(p.meta)}
                    extra={
                      p.rule.renderer === 'dynamic'
                        ? 'Unverified · Sandboxed Three.js'
                        : `${p.rule.charts.length} charts`
                    }
                  />
                </button>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => openInstalled(p)}>
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() =>
                      void deleteInstalledPack(p.meta.id).then(() => {
                        void refreshInstalled()
                        toast.success('Removed from library')
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
    </>
  )
}
