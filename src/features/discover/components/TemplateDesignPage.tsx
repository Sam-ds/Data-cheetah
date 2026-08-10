import { useEffect } from 'react'
import { ArrowLeft, Box, Code2, FileJson, FileSpreadsheet, LineChart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { goHome } from '@/features/workspace/goHome'
import { PageStage } from '@/features/workspace/components/PageStage'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import cheetahPacksHero from '@/assets/illustrations/cheetah-packs-hero.png'
import {
  TEMPLATE_DESIGN_INTRO,
  TEMPLATE_DESIGN_SECTIONS,
  type TemplateDesignSection,
} from '../content/templateDesignCopy'

function PackTypesDiagram() {
  return (
    <div className="template-guide-diagram template-guide-diagram--packs" aria-hidden>
      <article className="template-guide-pack">
        <header>
          <LineChart className="h-4 w-4" />
          <span>Chart template</span>
        </header>
        <ul>
          <li>meta.json</li>
          <li>rule.json → charts</li>
          <li>sample.csv</li>
        </ul>
        <p>No custom JavaScript</p>
      </article>
      <div className="template-guide-diagram-join">same roles</div>
      <article className="template-guide-pack template-guide-pack--viz">
        <header>
          <Box className="h-4 w-4" />
          <span>Visualization pack</span>
        </header>
        <ul>
          <li>meta.json</li>
          <li>rule.json → dynamic</li>
          <li>sample.csv</li>
          <li>visualization.js</li>
        </ul>
        <p>Sandboxed Three.js</p>
      </article>
    </div>
  )
}

function ZipFilesDiagram() {
  return (
    <div className="template-guide-diagram template-guide-diagram--zip" aria-hidden>
      <div className="template-guide-zip">
        <p className="template-guide-zip-title">my-pack.datacheetah-dashboard.zip</p>
        <ul>
          <li>
            <FileJson className="h-3.5 w-3.5" />
            <span>meta.json</span>
            <em>name · publisher · version · insights</em>
          </li>
          <li>
            <FileJson className="h-3.5 w-3.5" />
            <span>rule.json</span>
            <em>roles · charts or dynamic</em>
          </li>
          <li>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>sample.csv</span>
            <em>demo for Use sample data</em>
          </li>
          <li className="template-guide-zip-optional">
            <Code2 className="h-3.5 w-3.5" />
            <span>visualization.js</span>
            <em>Three.js packs only</em>
          </li>
        </ul>
      </div>
    </div>
  )
}

function SectionDiagram({ diagram }: { diagram: NonNullable<TemplateDesignSection['diagram']> }) {
  if (diagram === 'pack-types') return <PackTypesDiagram />
  return <ZipFilesDiagram />
}

function openGuideSection(sectionId: string) {
  const { appMode, setAppMode, setGuideScrollTarget } = useWorkspaceStore.getState()
  setGuideScrollTarget(sectionId)
  if (appMode !== 'template-design') setAppMode('template-design')
}

/** Renders plain text with optional markdown links: [label](url) or [label](app:section-id) */
function GuideText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g)
  return (
    <>
      {parts.map((part, index) => {
        const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (!match) return <span key={index}>{part}</span>
        const [, label, href] = match
        if (href.startsWith('app:')) {
          const sectionId = href.slice(4)
          return (
            <button
              key={index}
              type="button"
              className="template-guide-link"
              onClick={() => openGuideSection(sectionId)}
            >
              {label}
            </button>
          )
        }
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="template-guide-link"
          >
            {label}
          </a>
        )
      })}
    </>
  )
}

export function TemplateDesignPage() {
  const guideScrollTarget = useWorkspaceStore((s) => s.guideScrollTarget)
  const setGuideScrollTarget = useWorkspaceStore((s) => s.setGuideScrollTarget)

  useEffect(() => {
    if (!guideScrollTarget) return
    const timer = window.setTimeout(() => {
      const el = document.getElementById(guideScrollTarget)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setGuideScrollTarget(null)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [guideScrollTarget, setGuideScrollTarget])

  return (
    <PageStage
      enterKey="template-design"
      showArt={false}
      contentClassName="mx-auto w-full max-w-5xl px-6 py-8 pb-16"
    >
      <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-1.5" onClick={goHome}>
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Button>

      <h1 className="page-title">Build packs</h1>
      <p className="template-guide-audience mt-3">
        <Code2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Developer community
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {TEMPLATE_DESIGN_INTRO}
      </p>

      <div className="mt-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => openGuideSection('open-dashboard')}
        >
          <FileJson className="h-3.5 w-3.5" />
          Open Dashboard pack standard
        </Button>
      </div>

      <figure className="template-guide-hero">
        <img
          src={cheetahPacksHero}
          alt="Build reusable Discover packs for the community — chart templates on the left, sandboxed Three.js scenes on the right"
          className="template-guide-hero-img"
          width={1024}
          height={390}
          decoding="async"
        />
      </figure>

      <div className="page-stagger mt-10 space-y-6 text-left">
        <div className="template-guide">
          {TEMPLATE_DESIGN_SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="template-guide-section"
            >
              <h2>{section.title}</h2>
              <p>
                <GuideText text={section.body} />
              </p>
              {section.diagram && <SectionDiagram diagram={section.diagram} />}
              {section.steps && (
                <ol className="template-guide-steps">
                  {section.steps.map((step) => (
                    <li key={step}>
                      <GuideText text={step} />
                    </li>
                  ))}
                </ol>
              )}
              {section.items && (
                <ul className="template-guide-items">
                  {section.items.map((item) => (
                    <li key={item}>
                      <GuideText text={item} />
                    </li>
                  ))}
                </ul>
              )}
              {section.code && <pre className="template-guide-code">{section.code}</pre>}
            </section>
          ))}
        </div>
      </div>
    </PageStage>
  )
}
