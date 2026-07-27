import { useState } from 'react'
import { Upload, Shield, Zap, Lock, HardDrive, Loader2 } from 'lucide-react'
import logo from '@/assets/logo.png'
import { cn } from '@/lib/utils/cn'
import { useFileImport } from '@/features/files/hooks/useFileImport'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { hasSeenDuckDBEngine } from '@/hooks/useDuckDB'

const USEFUL_FOR = [
  {
    title: 'Explore a CSV or Excel file fast',
    body: 'Open sales exports, logs, or survey dumps and query them with SQL — no database setup.',
  },
  {
    title: 'Keep sensitive data on your machine',
    body: 'Finance, HR, or customer files stay in the browser. Nothing is uploaded to a server.',
  },
  {
    title: 'Prototype SQL before production',
    body: 'Try joins, filters, and aggregations locally with DuckDB before wiring a real warehouse.',
  },
  {
    title: 'Quick charts and column stats',
    body: 'See shapes in your data with auto charts and per-column profiling after you run a query.',
  },
]

const FAQ = [
  {
    q: 'Does my data leave my computer?',
    a: 'No. Files are read in your browser and queried with DuckDB WASM. There is no upload API for datasets.',
  },
  {
    q: 'Why a ~10 MB download when I open a file?',
    a: 'That is the DuckDB SQL engine (compressed). It downloads once per browser, then starts from cache. Tools like JSON formatter work without it.',
  },
  {
    q: 'What happens if I refresh the page?',
    a: 'Open datasets are cleared (they live in memory only). Theme, saved query text, and the cached engine stay. Open the file again to continue.',
  },
  {
    q: 'Which file types are supported?',
    a: 'CSV, TSV, Parquet, JSON / JSONL, and Excel (.xlsx / .xls). Nested JSON objects with a row array are unwrapped into a table when possible.',
  },
  {
    q: 'Is this free to use and host?',
    a: 'Yes for users. It is a static app — compute runs on your device. Hosting only serves app files (e.g. GitHub Pages).',
  },
  {
    q: 'How is this different from DuckDB itself?',
    a: 'DuckDB is the engine. DataCheetah is a local UI around it: file drop, SQL editor, results grid, charts, profiling, and browser tools.',
  },
]

export function EmptyState() {
  const { handleDrop, handleFileInput, importStatus } = useFileImport()
  const duckdbStatus = usePreferencesStore((s) => s.duckdbStatus)
  const isLoading = importStatus === 'loading'
  const isEngineLoading = duckdbStatus === 'loading'
  const seenEngine = hasSeenDuckDBEngine()
  const [dragging, setDragging] = useState(false)

  const dropTitle = isEngineLoading
    ? seenEngine
      ? 'Starting SQL engine…'
      : 'Downloading SQL engine…'
    : isLoading
      ? 'Loading dataset…'
      : dragging
        ? 'Release to open'
        : 'Drop a file or click to browse'

  const dropHint = isEngineLoading
    ? seenEngine
      ? 'Using your cached engine — almost ready.'
      : 'One-time ~10 MB download. Cached in your browser — your data never leaves this device.'
    : 'CSV · Parquet · JSON · Excel'

  return (
    <div className="home-stage flex h-full flex-col items-center p-8 pb-16">
      <div className="home-orb home-orb--amber" aria-hidden />
      <div className="home-orb home-orb--sky" aria-hidden />
      <div className="home-orb home-orb--mint" aria-hidden />
      <div className="home-blazes" aria-hidden>
        <span className="home-blaze" />
        <span className="home-blaze" />
        <span className="home-blaze" />
        <span className="home-blaze" />
        <span className="home-blaze" />
      </div>

      <div className="home-content flex w-full max-w-2xl flex-col items-center gap-10 text-center pt-6 sm:pt-10">
        <div className="home-logo-frame">
          <img
            src={logo}
            alt="DataCheetah"
            className="home-logo h-40 w-auto max-w-[min(400px,85vw)] rounded-lg object-contain"
          />
        </div>

        <div className="home-fade-up home-fade-up-delay-1 space-y-2">
          <p className="text-base font-medium tracking-tight text-foreground">
            Local-first SQL. Zero upload.
          </p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Drop a dataset and query in seconds — everything runs in your browser.
          </p>
        </div>

        <label
          className={cn(
            'home-drop home-fade-up home-fade-up-delay-2 flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12',
            isLoading && 'pointer-events-none opacity-60',
            dragging && 'border-[#f2a01f] bg-[rgba(242,160,31,0.08)]',
          )}
          onDrop={(e) => {
            setDragging(false)
            handleDrop(e)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
        >
          <input
            type="file"
            className="hidden"
            accept=".csv,.tsv,.parquet,.json,.jsonl,.xlsx,.xls"
            onChange={handleFileInput}
          />
          {isLoading ? (
            <Loader2 className="h-9 w-9 animate-spin text-[#f2a01f]" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(242,160,31,0.15)] text-[#f2a01f]">
              <Upload className="h-6 w-6" />
            </div>
          )}
          <p className="mt-4 text-sm font-semibold text-foreground">{dropTitle}</p>
          <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">{dropHint}</p>
        </label>

        <p className="home-fade-up home-fade-up-delay-2 flex max-w-md items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-left text-xs leading-relaxed text-muted-foreground">
          <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f2a01f]" />
          <span>
            {seenEngine
              ? 'SQL engine is cached in this browser. Opening a file starts it quickly — your data still never leaves this device.'
              : 'Opening a file downloads the DuckDB SQL engine once (~10 MB). It stays in your browser cache. Tools (JSON formatter, etc.) work without that download.'}
          </span>
        </p>

        <div className="home-fade-up home-fade-up-delay-3 flex flex-wrap items-center justify-center gap-2">
          <span className="home-chip home-chip--amber">
            <Zap className="h-3 w-3" />
            Instant SQL
          </span>
          <span className="home-chip home-chip--sky">
            <Lock className="h-3 w-3" />
            Stays on device
          </span>
          <span className="home-chip home-chip--mint">
            <Shield className="h-3 w-3" />
            No account
          </span>
        </div>

        <section className="home-fade-up home-fade-up-delay-4 w-full text-left">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">How it’s useful</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Built for quick, private analysis without standing up a database.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {USEFUL_FOR.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-border/50 bg-background/50 px-3.5 py-3 backdrop-blur-sm"
              >
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full text-left pb-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">FAQ</h2>
          <p className="mt-1 text-xs text-muted-foreground">Common questions about privacy, size, and how it works.</p>
          <div className="mt-4 space-y-2">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border/50 bg-background/50 px-3.5 py-2.5 open:bg-background/70"
              >
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {item.q}
                    <span className="text-muted-foreground transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 border-t border-border/40 pt-2 text-xs leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="flex flex-col items-center gap-2 pb-2">
          <p className="text-xs text-muted-foreground/60">Powered by open source</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            {[
              { name: 'DuckDB', href: 'https://duckdb.org' },
              { name: 'React', href: 'https://react.dev' },
              { name: 'Monaco Editor', href: 'https://microsoft.github.io/monaco-editor/' },
              { name: 'AG Grid', href: 'https://www.ag-grid.com' },
              { name: 'Apache ECharts', href: 'https://echarts.apache.org' },
              { name: 'sqlglot', href: 'https://github.com/tobymao/sqlglot' },
            ].map(({ name, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                {name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
