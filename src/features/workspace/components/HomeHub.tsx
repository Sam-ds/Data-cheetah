import {
  ArrowRight,
  Braces,
  Compass,
  Database,
  FileDiff,
  GitCompare,
  Minimize2,
  Scale,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import hero from '@/assets/illustrations/datacheetah-suite-logo.png'
import dataPipeline from '@/assets/illustrations/data-pipeline.png'
import inspect from '@/assets/illustrations/inspect.png'
import security from '@/assets/illustrations/security.png'
import collabDashboard from '@/assets/illustrations/collab-dashboard.png'
import team from '@/assets/illustrations/team.png'
import cloudSync from '@/assets/illustrations/cloud-sync.png'
import mascotVisualize from '@/assets/illustrations/mascot-visualize.png'
import mascotGenerate from '@/assets/illustrations/mascot-generate.png'
import mascotFormatters from '@/assets/illustrations/mascot-formatters.png'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { TOOL_LABELS, useToolsStore, type ToolId } from '@/features/tools/store/toolsStore'
import { DISCOVER_BLURB } from '@/features/discover/content/discoverCopy'
import { PageStage } from './PageStage'

function GitHubLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.2c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.95 10.95 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  )
}

function LinkedInLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M5.34 3.5A2.34 2.34 0 1 1 .66 3.5a2.34 2.34 0 0 1 4.68 0ZM.9 7.3h4.87V23H.9V7.3Zm7.9 0h4.67v2.15h.07c.65-1.23 2.24-2.53 4.61-2.53 4.93 0 5.85 3.25 5.85 7.47V23h-4.87v-7.64c0-1.82-.04-4.17-2.54-4.17-2.54 0-2.93 1.99-2.93 4.04V23H8.8V7.3Z" />
    </svg>
  )
}

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
      id: 'discover'
      label: string
      blurb: string
      tag: string
      icon: LucideIcon
      kind: 'discover'
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

const DISCOVER: HomeItem = {
  id: 'discover',
  label: 'Discover',
  blurb: DISCOVER_BLURB,
  tag: 'Templates',
  icon: Compass,
  kind: 'discover',
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
    blurb: 'Load CSV, Parquet, JSON, and Excel — query it and visualize with preset rules.',
    image: dataPipeline,
    alt: 'Data sources flowing into a dashboard',
  },
  {
    title: 'Templates & live packs',
    blurb: 'Discover ready-made dashboards and interactive packs — map your columns and run them on your data.',
    image: collabDashboard,
    alt: 'Dashboard templates and interactive packs',
  },
  {
    title: 'Ask your data',
    blurb: 'Natural-language Insights with local WebLLM or a remote model you configure.',
    image: inspect,
    alt: 'Inspecting charts with a magnifying glass',
  },
  {
    title: 'Private by design',
    blurb: 'Files and queries stay on-device unless you opt into a remote model for Ask.',
    image: security,
    alt: 'Security checklist and shield',
  },
  {
    title: 'Everyday data tools',
    blurb: 'Format and diff JSON or text, and generate synthetic rows with faker.js.',
    image: cloudSync,
    alt: 'Local tools syncing data workflows',
  },
  {
    title: 'Build & share packs',
    blurb: 'Publish portable dashboard ZIPs — others install them and run on their own data.',
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
        className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]"
        aria-hidden
      />
    </button>
  )
}

export function HomeHub() {
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const openTool = useToolsStore((s) => s.openTool)

  const openExplore = () => setAppMode('explore')
  const openDiscover = () => setAppMode('discover')
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
      <header className="home-hero-header w-full pt-2">
        <div className="home-hero-stage">
          <div className="home-hero-track home-hero-track--suite">
            <div className="home-hero-frame home-hero-frame--suite">
              <img
                src={hero}
                alt="DataCheetah Suite"
                className="home-hero home-hero--suite"
                width={1024}
                height={390}
                decoding="async"
              />
            </div>
          </div>
        </div>
        <p className="home-tagline mx-auto mt-2 px-6 text-center sm:px-8">
          <span className="home-tagline-text">A suite of data tools</span>
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-10 px-6 sm:px-8">
        <section
          className="home-feature-split home-fade-up"
          aria-labelledby="home-workspace"
        >
          <div className="home-feature-copy">
            <h2
              id="home-workspace"
              className="page-eyebrow mb-1"
            >
              Workspace
            </h2>
            <nav className="home-rows flex flex-col" aria-label="Workspace">
              <HomeRow item={DISCOVER} onClick={openDiscover} />
              <HomeRow item={WORKSPACE} onClick={openExplore} />
            </nav>
          </div>
          <img
            src={mascotVisualize}
            alt="DataCheetah visualizing charts"
            className="home-illu home-illu--side home-illu--mascot home-illu--workspace"
          />
        </section>

        <section
          className="home-feature-split home-feature-split--reverse home-fade-up home-fade-up-delay-1"
          aria-labelledby="home-tools"
        >
          <div className="home-feature-copy">
            <h2
              id="home-tools"
              className="page-eyebrow mb-1"
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
            className="home-illu home-illu--side home-illu--mascot home-illu--formatters"
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
            <span className="page-eyebrow">
              Generate Data
            </span>
            <span className="mt-1 block text-base font-semibold tracking-tight text-foreground">
              Seed synthetic datasets in the browser
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              LLM seed rows, then expand with faker.js — nothing leaves your device unless you choose.
            </span>
            <span className="brand-link mt-3 inline-flex items-center gap-1 text-[11px] font-medium group-hover:underline">
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
          className="page-eyebrow mb-6"
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

      <section className="home-community home-fade-up px-6 sm:px-8" aria-labelledby="home-community">
        <div>
          <span className="page-eyebrow">Built with open source tools</span>
          <h2 id="home-community" className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            Help improve DataCheetah?
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Contributions, ideas, and practical feedback are welcome.
          </p>
        </div>
        <div className="home-community-links">
          <a
            href="https://github.com/Sam-ds/Data-cheetah"
            target="_blank"
            rel="noreferrer"
            className="home-community-link group"
            aria-label="Contribute to DataCheetah on GitHub"
          >
            <span className="home-community-icon"><GitHubLogo className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-semibold text-foreground">Contributions welcome</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">View the project on GitHub</span>
            </span>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </a>
          <button
            type="button"
            onClick={() => setAppMode('license')}
            className="home-community-link group text-left"
            aria-label="View DataCheetah license and open source credits"
          >
            <span className="home-community-icon">
              <Scale className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">License & credits</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Apache 2.0 and third-party licenses</span>
            </span>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </button>
          <a
            href="https://www.linkedin.com/in/sampath-kumar-385a0892/"
            target="_blank"
            rel="noreferrer"
            className="home-community-link group"
            aria-label="Connect with Sampath Kumar on LinkedIn for ideas and suggestions"
          >
            <span className="home-community-icon home-community-icon--linkedin">
              <LinkedInLogo className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">Ideas or suggestions?</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Connect on LinkedIn</span>
            </span>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </section>

    </PageStage>
  )
}
