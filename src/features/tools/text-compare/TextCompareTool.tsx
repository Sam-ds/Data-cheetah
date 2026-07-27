import { useState } from 'react'
import { compareText } from './compareText'
import type { DiffLine } from './compareText'
import { SideBySideDiff } from '../components/SideBySideDiff'
import {
  ToolPane,
  ToolTextarea,
  ToolActionButton,
  sizeWarning,
} from '../components/ToolPane'

export function TextCompareTool() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [lines, setLines] = useState<DiffLine[]>([])
  const [compared, setCompared] = useState(false)

  const handleCompare = () => {
    setLines(compareText(left, right))
    setCompared(true)
  }

  const handleClear = () => {
    setLeft('')
    setRight('')
    setLines([])
    setCompared(false)
  }

  return (
    <ToolPane
      title="Text Compare"
      description="Side-by-side line diff. Green = added, red = removed, amber = changed."
      warning={sizeWarning(left, right)}
      actions={
        <>
          <ToolActionButton onClick={handleCompare}>Compare</ToolActionButton>
          <ToolActionButton variant="ghost" onClick={handleClear}>
            Clear
          </ToolActionButton>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="grid h-[40%] min-h-[140px] grid-cols-1 gap-3 md:grid-cols-2">
          <ToolTextarea
            label="Left text"
            placeholder="Paste original text…"
            value={left}
            onChange={(e) => setLeft(e.target.value)}
          />
          <ToolTextarea
            label="Right text"
            placeholder="Paste modified text…"
            value={right}
            onChange={(e) => setRight(e.target.value)}
          />
        </div>
        <div className="min-h-0 flex-1">
          {compared ? (
            <SideBySideDiff lines={lines} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border text-sm text-muted-foreground">
              Paste text on both sides and click Compare
            </div>
          )}
        </div>
      </div>
    </ToolPane>
  )
}
