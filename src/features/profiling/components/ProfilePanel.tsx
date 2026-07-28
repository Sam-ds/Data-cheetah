import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart3,
  CopyPlus,
  Download,
  Fingerprint,
  Loader2,
  Maximize2,
  Minimize2,
  ScanSearch,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProfileStore } from '@/features/profiling/store/profileStore'
import { useFilesStore } from '@/features/files/store/filesStore'
import { profileTable } from '@/features/profiling/services/profilingService'
import { duckdbClient } from '@/services/duckdbClient'
import { downloadBuffer } from '@/services/exportService'
import { cn } from '@/lib/utils/cn'
import { ColumnStats } from './ColumnStats'

interface ProfilePanelProps {
  embedded?: boolean
}

type ExportFormat = 'csv' | 'json' | 'parquet'

type DedupStats = {
  tableName: string
  totalRows: number
  distinctRows: number
  duplicateRows: number
  columnCount: number
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export function ProfilePanel({ embedded = false }: ProfilePanelProps) {
  const profile = useProfileStore((s) => s.profile)
  const isLoading = useProfileStore((s) => s.isLoading)
  const setProfile = useProfileStore((s) => s.setProfile)
  const setIsLoading = useProfileStore((s) => s.setIsLoading)

  const activeFileId = useFilesStore((s) => s.activeFileId)
  const files = useFilesStore((s) => s.files)
  const restoringLocal = useFilesStore((s) => s.restoringLocal)
  const activeFile =
    files.find((f) => f.id === activeFileId) ?? (files.length > 0 ? files[files.length - 1]! : null)

  const requestId = useRef(0)
  const lastProfiledTable = useRef<string | null>(null)

  const [fullscreen, setFullscreen] = useState(false)
  const [showProfiler, setShowProfiler] = useState(false)
  const [dedup, setDedup] = useState<DedupStats | null>(null)
  const [dedupLoading, setDedupLoading] = useState(false)
  const [dedupError, setDedupError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  useEffect(() => {
    if (restoringLocal) return

    if (!activeFile) {
      lastProfiledTable.current = null
      setProfile(null)
      setIsLoading(false)
      setDedup(null)
      setShowProfiler(false)
      return
    }

    const tableName = activeFile.tableName
    const existing = useProfileStore.getState().profile
    if (lastProfiledTable.current === tableName && existing?.tableName === tableName) {
      return
    }

    const id = ++requestId.current
    lastProfiledTable.current = tableName
    setIsLoading(true)
    setDedup(null)
    void profileTable(tableName)
      .then((next) => {
        if (requestId.current !== id) return
        setProfile(next)
      })
      .catch(() => {
        if (requestId.current !== id) return
        if (lastProfiledTable.current === tableName) lastProfiledTable.current = null
        setProfile(null)
        setIsLoading(false)
      })
  }, [activeFile?.id, activeFile?.tableName, restoringLocal, setProfile, setIsLoading])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) setShowProfiler(false)
  }, [fullscreen])

  const runProfiler = useCallback(async () => {
    if (!activeFile) return
    setShowProfiler(true)
    setDedupLoading(true)
    setDedupError(null)
    setExportMessage(null)
    try {
      const stats = await duckdbClient.dedupStats(activeFile.tableName)
      setDedup(stats)
    } catch (err) {
      setDedup(null)
      setDedupError(err instanceof Error ? err.message : String(err))
    } finally {
      setDedupLoading(false)
    }
  }, [activeFile])

  const exportDeduped = useCallback(
    async (format: ExportFormat) => {
      if (!activeFile) return
      setExporting(format)
      setExportMessage(null)
      setDedupError(null)
      const base = activeFile.tableName.replace(/[^\w.-]+/g, '_') || 'data'
      const fileName = `${base}_deduped.${format}`
      try {
        const sql = `SELECT DISTINCT * FROM ${quoteIdent(activeFile.tableName)}`
        const exported = await duckdbClient.exportSql(sql, format, fileName)
        downloadBuffer(exported.buffer, exported.fileName, exported.mime)
        setExportMessage(`Saved ${exported.fileName}`)
      } catch (err) {
        setDedupError(err instanceof Error ? err.message : String(err))
      } finally {
        setExporting(null)
      }
    },
    [activeFile],
  )

  const emptyMessage = (() => {
    if (files.length > 0 && activeFile) {
      return `Could not profile “${activeFile.tableName}”. Try switching files or re-opening the dataset.`
    }
    if (files.length > 0) {
      return 'Select a file in the sidebar to see column statistics.'
    }
    return 'Load a file to see column statistics'
  })()

  const columnStatsBody =
    isLoading || restoringLocal ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {activeFile ? `Profiling ${activeFile.tableName}…` : 'Loading…'}
      </div>
    ) : !profile ? (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    ) : (
      <div className="flex-1 overflow-y-auto">
        <div className="border-b px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{profile.tableName}</span>
          {' · '}
          {profile.rowCount.toLocaleString()} rows · {profile.columnCount} columns
          {profile.duplicateCount != null && profile.duplicateCount > 0 && (
            <span className="ml-2 text-amber-600">
              {profile.duplicateCount.toLocaleString()} duplicates
            </span>
          )}
        </div>
        {profile.columns.map((col) => (
          <ColumnStats key={col.columnName} profile={col} />
        ))}
      </div>
    )

  const profilerBody = (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Table profiler
            </p>
            <h3 className="mt-0.5 text-lg font-semibold tracking-tight">
              {activeFile?.tableName ?? 'No table selected'}
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Distinct rows vs full-row duplicates for the active file. Deduplicate with{' '}
              <span className="font-mono text-[11px]">SELECT DISTINCT *</span> and download.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!activeFile || dedupLoading}
            onClick={() => void runProfiler()}
          >
            {dedupLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanSearch className="h-3.5 w-3.5" />
            )}
            {dedup ? 'Refresh' : 'Run profiler'}
          </Button>
        </div>

        {dedupError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {dedupError}
          </div>
        )}

        {dedupLoading && !dedup ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-xs text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-[#f2a01f]" />
            Scanning rows for duplicates…
          </div>
        ) : dedup ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                icon={<CopyPlus className="h-4 w-4" />}
                label="Total rows"
                value={dedup.totalRows}
                hint={`${dedup.columnCount} columns`}
              />
              <MetricCard
                icon={<Fingerprint className="h-4 w-4" />}
                label="Distinct records"
                value={dedup.distinctRows}
                hint={
                  dedup.totalRows > 0
                    ? `${((dedup.distinctRows / dedup.totalRows) * 100).toFixed(1)}% unique`
                    : undefined
                }
                accent="emerald"
              />
              <MetricCard
                icon={<ScanSearch className="h-4 w-4" />}
                label="Duplicate rows"
                value={dedup.duplicateRows}
                hint={
                  dedup.duplicateRows > 0
                    ? 'Extra copies beyond first distinct row'
                    : 'No full-row duplicates'
                }
                accent={dedup.duplicateRows > 0 ? 'amber' : 'muted'}
              />
            </div>

            <section className="overflow-hidden rounded-xl border bg-gradient-to-br from-muted/40 via-background to-background">
              <div className="border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-[#f2a01f]" />
                  <div>
                    <p className="text-sm font-semibold">Dedupe &amp; save</p>
                    <p className="text-[11px] text-muted-foreground">
                      Export unique rows only · CSV · JSON · Parquet
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {(['csv', 'json', 'parquet'] as const).map((format) => (
                  <Button
                    key={format}
                    type="button"
                    variant={format === 'parquet' ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-[7.5rem] gap-1.5 capitalize"
                    disabled={!!exporting || dedup.distinctRows === 0}
                    onClick={() => void exportDeduped(format)}
                  >
                    {exporting === format ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {format}
                  </Button>
                ))}
              </div>
              {exportMessage && (
                <p className="border-t px-4 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                  {exportMessage}
                </p>
              )}
              {dedup.distinctRows === 0 && (
                <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
                  Nothing to export — table has no rows.
                </p>
              )}
            </section>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f2a01f]/15 text-[#f2a01f]">
              <ScanSearch className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">Ready to profile</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Count distinct records and full-row duplicates, then export a cleaned file.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={!activeFile}
              onClick={() => void runProfiler()}
            >
              <ScanSearch className="h-3.5 w-3.5" />
              Run profiler
            </Button>
          </div>
        )}

        {profile && showProfiler && (
          <details className="rounded-xl border">
            <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground">
              Column statistics
            </summary>
            <div className="max-h-80 overflow-y-auto border-t">
              {profile.columns.map((col) => (
                <ColumnStats key={col.columnName} profile={col} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )

  const panelBody = (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {!fullscreen && !embedded && (
        <div className="flex shrink-0 items-center justify-between gap-1 border-b border-border/40 px-2 py-1">
          <div className="panel-header border-0 px-1 py-0">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Statistics
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
            onClick={() => setFullscreen(true)}
            title="Open Statistics in full screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Full screen
          </Button>
        </div>
      )}
      {!fullscreen && embedded && (
        <div className="flex shrink-0 justify-end border-b border-border/40 px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
            onClick={() => setFullscreen(true)}
            title="Open Statistics in full screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Full screen
          </Button>
        </div>
      )}
      {fullscreen && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
          <div className="inline-flex rounded-lg border bg-background p-0.5">
            <TabChip active={!showProfiler} onClick={() => setShowProfiler(false)}>
              Columns
            </TabChip>
            <TabChip
              active={showProfiler}
              onClick={() => {
                if (!showProfiler) void runProfiler()
                else setShowProfiler(true)
              }}
            >
              <ScanSearch className="h-3 w-3" />
              Profiler
            </TabChip>
          </div>
          {activeFile && (
            <span className="truncate text-[11px] text-muted-foreground">{activeFile.tableName}</span>
          )}
        </div>
      )}
      {fullscreen && showProfiler ? profilerBody : columnStatsBody}
    </div>
  )

  const fullscreenOverlay =
    fullscreen &&
    createPortal(
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <BarChart3 className="h-4 w-4 text-[#f2a01f]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Statistics</p>
            <p className="text-[11px] text-muted-foreground">
              Column profile · Profiler · Esc to exit
            </p>
          </div>
          <Button
            type="button"
            variant={showProfiler ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            disabled={!activeFile}
            onClick={() => void runProfiler()}
          >
            <ScanSearch className="h-3.5 w-3.5" />
            Profiler
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setFullscreen(false)}
            title="Exit full screen (Esc)"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Exit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setFullscreen(false)}
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{panelBody}</div>
      </div>,
      document.body,
    )

  return (
    <>
      {fullscreen ? (
        <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
          Statistics is open in full screen.
          <Button
            type="button"
            variant="link"
            className="h-auto px-1 text-xs"
            onClick={() => setFullscreen(false)}
          >
            Bring it back
          </Button>
        </div>
      ) : (
        panelBody
      )}
      {fullscreenOverlay}
    </>
  )
}

function TabChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  accent = 'default',
}: {
  icon: ReactNode
  label: string
  value: number
  hint?: string
  accent?: 'default' | 'emerald' | 'amber' | 'muted'
}) {
  const accentClass =
    accent === 'emerald'
      ? 'border-emerald-500/25 from-emerald-500/10'
      : accent === 'amber'
        ? 'border-amber-500/30 from-amber-500/10'
        : accent === 'muted'
          ? 'border-border from-muted/30'
          : 'border-border from-[#f2a01f]/10'

  return (
    <div className={cn('rounded-xl border bg-gradient-to-br to-background p-4', accentClass)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums">
        {value.toLocaleString()}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
