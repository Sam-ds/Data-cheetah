import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import stageArt from '@/assets/hero.png'

interface PageStageProps {
  children: ReactNode
  className?: string
  contentClassName?: string
  /** Re-run enter animation when this key changes (e.g. app mode / tool id). */
  enterKey?: string | number
  /** Apply page-enter on the content shell (default true). */
  animateEnter?: boolean
  scroll?: boolean
  /** Soft brand watermark (default true on hub pages). */
  showArt?: boolean
}

/** Shared futuristic stage shell for hub pages (Home-style grid + enter motion). */
export function PageStage({
  children,
  className,
  contentClassName,
  enterKey,
  animateEnter = true,
  scroll = true,
  showArt = true,
}: PageStageProps) {
  return (
    <div
      className={cn(
        'page-stage relative flex h-full min-h-0 flex-col overflow-hidden',
        className,
      )}
    >
      <div className="page-grid" aria-hidden />
      {showArt && (
        <div
          className="page-stage-art"
          style={{ backgroundImage: `url(${stageArt})` }}
          aria-hidden
        />
      )}
      <div
        key={enterKey}
        className={cn(
          'page-content relative z-10 min-h-0 flex-1',
          scroll ? 'overflow-auto' : 'overflow-hidden',
          animateEnter && 'page-enter',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
