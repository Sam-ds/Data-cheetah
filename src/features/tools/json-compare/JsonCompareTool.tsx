import { useState } from 'react'
import { compareJson } from './compareJson'
import type { DiffLine } from './compareJson'
import { SideBySideDiff } from '../components/SideBySideDiff'
import {
  ToolPane,
  ToolTextarea,
  ToolActionButton,
  ToolEmptyState,
  sizeWarning,
} from '../components/ToolPane'
import { cn } from '@/lib/utils/cn'
import { GitCompare } from 'lucide-react'

export function JsonCompareTool() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [leftError, setLeftError] = useState<string | null>(null)
  const [rightError, setRightError] = useState<string | null>(null)
  const [lines, setLines] = useState<DiffLine[]>([])
  const [compared, setCompared] = useState(false)

  const handleCompare = () => {
    const result = compareJson(left, right)
    if (!result.ok) {
      setError(result.error)
      setLeftError(result.leftError ?? null)
      setRightError(result.rightError ?? null)
      setLines([])
      setCompared(false)
      return
    }
    setError(null)
    setLeftError(null)
    setRightError(null)
    setLines(result.lines)
    setCompared(true)
  }

  const handleClear = () => {
    setLeft('')
    setRight('')
    setError(null)
    setLeftError(null)
    setRightError(null)
    setLines([])
    setCompared(false)
  }

  return (
    <ToolPane
      title="JSON Compare"
      description="Normalize both sides (sorted keys, pretty-print) then diff line-by-line. Both sides must be valid JSON."
      error={error}
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
          <div className="flex min-h-0 flex-col gap-1">
            <ToolTextarea
              label="Left JSON"
              tone="sky"
              placeholder='{"a":1}'
              value={left}
              onChange={(e) => {
                setLeft(e.target.value)
                setLeftError(null)
              }}
              className={cn(leftError && 'border-destructive focus:ring-destructive')}
            />
            {leftError && (
              <p className="text-[11px] text-destructive">{leftError}</p>
            )}
          </div>
          <div className="flex min-h-0 flex-col gap-1">
            <ToolTextarea
              label="Right JSON"
              tone="violet"
              placeholder='{"a":2}'
              value={right}
              onChange={(e) => {
                setRight(e.target.value)
                setRightError(null)
              }}
              className={cn(rightError && 'border-destructive focus:ring-destructive')}
            />
            {rightError && (
              <p className="text-[11px] text-destructive">{rightError}</p>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {compared ? (
            <SideBySideDiff
              lines={lines}
              leftTitle="Left (normalized)"
              rightTitle="Right (normalized)"
            />
          ) : (
            <ToolEmptyState
              icon={<GitCompare className="h-5 w-5" />}
              title="Ready to compare"
              description={<>
                Paste valid JSON on both sides and click Compare.
                <br />
                Tip: booleans must be <code className="font-mono">true</code> /{' '}
                <code className="font-mono">false</code> (not <code className="font-mono">fale</code>).
              </>}
            />
          )}
        </div>
      </div>
    </ToolPane>
  )
}
