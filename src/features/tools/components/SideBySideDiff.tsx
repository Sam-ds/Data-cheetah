import { useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import type { DiffLine } from '../lib/lineDiff'

interface SideBySideDiffProps {
  lines: DiffLine[]
  leftTitle?: string
  rightTitle?: string
}

function rowClass(type: DiffLine['type'], side: 'left' | 'right'): string {
  if (type === 'same') return ''
  if (type === 'change') return 'bg-amber-500/15'
  if (type === 'add') return side === 'right' ? 'bg-emerald-500/20' : 'bg-muted/40'
  if (type === 'remove') return side === 'left' ? 'bg-red-500/20' : 'bg-muted/40'
  return ''
}

export function SideBySideDiff({
  lines,
  leftTitle = 'Left',
  rightTitle = 'Right',
}: SideBySideDiffProps) {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)

  const syncScroll = (source: 'left' | 'right') => {
    if (syncing.current) return
    syncing.current = true
    const from = source === 'left' ? leftRef.current : rightRef.current
    const to = source === 'left' ? rightRef.current : leftRef.current
    if (from && to) {
      to.scrollTop = from.scrollTop
      to.scrollLeft = from.scrollLeft
    }
    requestAnimationFrame(() => {
      syncing.current = false
    })
  }

  if (lines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border text-sm text-muted-foreground">
        Run compare to see differences
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-2">
      <DiffColumn
        title={leftTitle}
        scrollRef={leftRef}
        onScroll={() => syncScroll('left')}
        lines={lines}
        side="left"
      />
      <DiffColumn
        title={rightTitle}
        scrollRef={rightRef}
        onScroll={() => syncScroll('right')}
        lines={lines}
        side="right"
      />
    </div>
  )
}

function DiffColumn({
  title,
  scrollRef,
  onScroll,
  lines,
  side,
}: {
  title: string
  scrollRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  lines: DiffLine[]
  side: 'left' | 'right'
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
      <div className="border-b bg-[var(--panel-header)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto text-[13px] leading-6"
      >
        {lines.map((line, idx) => {
          const text = side === 'left' ? line.left : line.right
          const num = side === 'left' ? line.leftLine : line.rightLine
          const empty = text === undefined
          return (
            <div
              key={idx}
              className={cn(
                'flex whitespace-pre',
                rowClass(line.type, side),
                empty && 'opacity-40',
              )}
            >
              <span className="w-10 shrink-0 select-none border-r px-2 text-right text-muted-foreground">
                {num ?? ''}
              </span>
              <span className="flex-1 px-2">{empty ? ' ' : text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
