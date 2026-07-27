import { Braces, Database, Wand2 } from 'lucide-react'
import logo from '@/assets/logo.png'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { useToolsStore } from '@/features/tools/store/toolsStore'

export function HomeHub() {
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const openTool = useToolsStore((s) => s.openTool)

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

      <div className="home-content flex w-full max-w-4xl flex-col items-center gap-10 text-center pt-6 sm:pt-10">
        <div className="home-logo-frame">
          <img
            src={logo}
            alt="DataCheetah"
            className="home-logo h-40 w-auto max-w-[min(400px,85vw)] rounded-lg object-contain"
          />
        </div>

        <div className="home-fade-up home-fade-up-delay-1 space-y-2">
          <p className="text-base font-semibold tracking-tight text-black dark:text-foreground">
            Blazing-fast data tools and exploration
          </p>
          <p className="mx-auto max-w-lg text-sm text-neutral-800 dark:text-muted-foreground">
            Explore datasets and tidy JSON on your machine, with the option to keep your data from
            ever leaving your device.
          </p>
        </div>

        <div className="home-fade-up home-fade-up-delay-2 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setAppMode('explore')}
            className="group rounded-2xl border border-neutral-300 bg-white px-5 py-6 text-left transition hover:border-[#f2a01f]/50 hover:bg-[rgba(242,160,31,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2a01f]/40 dark:border-border/60 dark:bg-background/55"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(242,160,31,0.15)] text-[#f2a01f]">
              <Database className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-black dark:text-foreground">Data exploration</p>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-800 dark:text-muted-foreground">
              Open CSV, Parquet, JSON, or Excel. Query with SQL, charts, stats, and Ask, all in the
              browser.
            </p>
            <p className="mt-3 text-[11px] font-medium text-[#b45309] group-hover:underline dark:text-[#f2a01f]">
              Open workspace →
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              openTool('json-format')
              setAppMode('tools')
            }}
            className="group rounded-2xl border border-neutral-300 bg-white px-5 py-6 text-left transition hover:border-sky-500/40 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 dark:border-border/60 dark:bg-background/55"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <Braces className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-black dark:text-foreground">JSON & text tools</p>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-800 dark:text-muted-foreground">
              Format, minify, and compare JSON or plain text.
            </p>
            <p className="mt-3 text-[11px] font-medium text-sky-700 group-hover:underline dark:text-sky-400">
              Open tools →
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              openTool('synthetic-data')
              setAppMode('tools')
            }}
            className="group rounded-2xl border border-neutral-300 bg-white px-5 py-6 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-border/60 dark:bg-background/55 sm:col-span-2 lg:col-span-1"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <Wand2 className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-black dark:text-foreground">Generate data</p>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-800 dark:text-muted-foreground">
              Seed a few realistic rows with your LLM, then expand with faker.js entirely in the
              browser.
            </p>
            <p className="mt-3 text-[11px] font-medium text-emerald-800 group-hover:underline dark:text-emerald-400">
              Generate data →
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
