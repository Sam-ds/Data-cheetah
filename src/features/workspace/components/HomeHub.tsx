import {
  ArrowRight,
  Braces,
  Database,
  FileDiff,
  GitCompare,
  Minimize2,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import hero from '@/assets/hero.png'
import collabDashboard from '@/assets/illustrations/collab-dashboard.png'
import dataPipeline from '@/assets/illustrations/data-pipeline.png'
import exploreSolo from '@/assets/illustrations/explore-solo.png'
import inspect from '@/assets/illustrations/inspect.png'
import security from '@/assets/illustrations/security.png'
import cloudSync from '@/assets/illustrations/cloud-sync.png'
import team from '@/assets/illustrations/team.png'
import mascotVisualize from '@/assets/illustrations/mascot-visualize.png'
import mascotGenerate from '@/assets/illustrations/mascot-generate.png'
import mascotFormatters from '@/assets/illustrations/mascot-formatters.png'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { TOOL_LABELS, useToolsStore, type ToolId } from '@/features/tools/store/toolsStore'
import { PageStage } from './PageStage'

type HomeItem =
  | {
      id: 'explore'
      label: string
      blurb: string
      tag: string
      icon: LucideIcon
      kind: 'explore'
    }
  | {
      id: ToolId
      label: string
      blurb: string
      tag: string
      icon: LucideIcon
      kind: 'tool'
      toolId: ToolId
    }

const WORKSPACE: HomeItem = {
  id: 'explore',
  label: 'Explore',
  blurb: 'SQL, charts, stats, and Ask — on your machine',
  tag: 'CSV · Parquet · JSON · Excel',
  icon: Database,
  kind: 'explore',
}

const TOOLS: Extract<HomeItem, { kind: 'tool' }>[] = [
  {
    id: 'json-format',
    label: TOOL_LABELS['json-format'],
    blurb: 'Pretty-print and tidy JSON in the browser',
    tag: 'JSON',
    icon: Braces,
    kind: 'tool',
    toolId: 'json-format',
  },
  {
    id: 'json-minify',
    label: TOOL_LABELS['json-minify'],
    blurb: 'Compact JSON into a single line',
    tag: 'JSON',
    icon: Minimize2,
    kind: 'tool',
    toolId: 'json-minify',
  },
  {
    id: 'json-compare',
    label: TOOL_LABELS['json-compare'],
    blurb: 'Diff two JSON documents side by side',
    tag: 'JSON',
    icon: GitCompare,
    kind: 'tool',
    toolId: 'json-compare',
  },
  {
    id: 'text-compare',
    label: TOOL_LABELS['text-compare'],
    blurb: 'Diff plain text or code snippets',
    tag: 'Text',
    icon: FileDiff,
    kind: 'tool',
    toolId: 'text-compare',
  },
  {
    id: 'synthetic-data',
    label: TOOL_LABELS['synthetic-data'],
    blurb: 'Seed rows with an LLM, expand with faker.js',
    tag: 'Data',
    icon: Wand2,
    kind: 'tool',
    toolId: 'synthetic-data',
  },
]

const FEATURES = [
  {
    title: 'Connect & explore',
    blurb: 'Bring CSV, Parquet, JSON, and Excel into DuckDB — all in the browser.',
    image: dataPipeline,
    alt: 'Data sources flowing into a dashboard',
  },
  {
    title: 'Visualize insights',
    blurb: 'Charts, profiles, and Ask help you see patterns without leaving your machine.',
    image: exploreSolo,
    alt: 'Person working with a data dashboard',
  },
  {
    title: 'Inspect what matters',
    blurb: 'Drill into stats, profiles, and results with a focused workspace.',
    image: inspect,
    alt: 'Inspecting charts with a magnifying glass',
  },
  {
    title: 'Analyze together',
    blurb: 'A shared workspace for SQL, results, and exploration side by side.',
    image: collabDashboard,
    alt: 'Two people reviewing an analytics dashboard',
  },
  {
    title: 'Private by design',
    blurb: 'Work stays on-device unless you choose a remote model for Insights.',
    image: security,
    alt: 'Security checklist and shield',
  },
  {
    title: 'Sync when you choose',
    blurb: 'Datasets stay local-first; optional remote models only when you connect them.',
    image: cloudSync,
    alt: 'Cloud sync between folder and database',
  },
  {
    title: 'Built for teams of one',
    blurb: 'Format, compare, generate, and explore — a full suite in one place.',
    image: team,
    alt: 'Small team collaborating with laptops',
  },
] as const

function HomeRow({
  item,
  onClick,
}: {
  item: HomeItem
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button type="button" onClick={onClick} className="home-section group">
      <span className="home-section-icon" aria-hidden>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-base font-semibold tracking-tight text-foreground">{item.label}</span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {item.tag}
          </span>
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{item.blurb}</span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-[#f2a01f]"
        aria-hidden
      />
    </button>
  )
}

export function HomeHub() {
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const openTool = useToolsStore((s) => s.openTool)

  const openExplore = () => setAppMode('explore')
  const openToolItem = (toolId: ToolId) => {
    openTool(toolId)
    setAppMode('tools')
  }

  return (
    <PageStage
      enterKey="home"
      animateEnter={false}
      showArt={false}
      contentClassName="mx-auto flex w-full max-w-5xl flex-1 flex-col px-0 pb-12 sm:pb-16"
    >
      <header className="home-hero-header w-full px-6 pt-4 sm:px-8">
        <div className="home-hero-frame">
          <img
            src={hero}
            alt="DataCheetah"
            className="home-hero"
          />
        </div>
        <p className="home-brand-name" aria-label="datacheetah">
          <span className="home-brand-data">data</span>
          <span className="home-brand-cheetah">cheetah</span>
        </p>
        <p className="home-tagline mx-auto mt-4 text-center">
          <span className="home-tagline-text">A suite of data tools</span>
        </p>
      </header>

      <div className="mt-12 flex flex-col gap-10 px-6 sm:px-8">
        <section
          className="home-feature-split home-fade-up"
          aria-labelledby="home-workspace"
        >
          <div className="home-feature-copy">
            <h2
              id="home-workspace"
              className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Workspace
            </h2>
            <nav className="home-rows flex flex-col" aria-label="Workspace">
              <HomeRow item={WORKSPACE} onClick={openExplore} />
            </nav>
          </div>
          <img
            src={mascotVisualize}
            alt="DataCheetah visualizing charts"
            className="home-illu home-illu--side home-illu--mascot"
          />
        </section>

        <section
          className="home-feature-split home-feature-split--reverse home-fade-up home-fade-up-delay-1"
          aria-labelledby="home-tools"
        >
          <div className="home-feature-copy">
            <h2
              id="home-tools"
              className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Tools
            </h2>
            <nav className="home-rows flex flex-col" aria-label="Tools">
              {TOOLS.map((item) => (
                <HomeRow
                  key={item.id}
                  item={item}
                  onClick={() => openToolItem(item.toolId)}
                />
              ))}
            </nav>
          </div>
          <img
            src={mascotFormatters}
            alt="DataCheetah formatting and tooling"
            className="home-illu home-illu--side home-illu--mascot"
          />
        </section>

        <button
          type="button"
          onClick={() => openToolItem('synthetic-data')}
          className="home-mascot-cta home-fade-up group"
        >
          <img
            src={mascotGenerate}
            alt=""
            className="home-illu home-illu--cta home-illu--mascot"
            aria-hidden
          />
          <span className="home-mascot-cta-copy">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Generate Data
            </span>
            <span className="mt-1 block text-base font-semibold tracking-tight text-foreground">
              Seed synthetic datasets in the browser
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              LLM seed rows, then expand with faker.js — nothing leaves your device unless you choose.
            </span>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#b45309] group-hover:underline dark:text-[#f2a01f]">
              Open Generate Data
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </span>
        </button>
      </div>

      <section
        className="home-fade-up home-fade-up-delay-2 mt-14 px-6 sm:px-8"
        aria-labelledby="home-capabilities"
      >
        <h2
          id="home-capabilities"
          className="mb-6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          Capabilities
        </h2>
        <div className="home-cap-grid">
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className="home-cap"
              style={{ animationDelay: `${0.08 * i + 0.15}s` }}
            >
              <img src={f.image} alt={f.alt} className="home-illu home-illu--cap" />
              <h3 className="mt-3 text-sm font-semibold tracking-tight text-foreground">
                {f.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.blurb}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-fade-up mt-auto px-6 pt-14 sm:px-8">
        <button
          type="button"
          onClick={() => setAppMode('license')}
          className="text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
        >
          Built using open source tools
        </button>
      </footer>
    </PageStage>
  )
}
