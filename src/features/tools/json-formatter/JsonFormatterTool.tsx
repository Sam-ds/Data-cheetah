import { useState } from 'react'
import { toast } from 'sonner'
import { formatJson } from './formatJson'
import {
  ToolPane,
  ToolTextarea,
  ToolActionButton,
  copyText,
  sizeWarning,
} from '../components/ToolPane'

export function JsonFormatterTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFormat = () => {
    const result = formatJson(input)
    if (!result.ok) {
      setError(result.error)
      setOutput('')
      return
    }
    setError(null)
    setOutput(result.output)
  }

  const handleCopy = async () => {
    if (!output) return
    const ok = await copyText(output)
    toast[ok ? 'success' : 'error'](ok ? 'Copied formatted JSON' : 'Copy failed')
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
    setError(null)
  }

  return (
    <ToolPane
      title="JSON Formatter"
      description="Pretty-print JSON with 2-space indentation. Runs entirely in your browser."
      error={error}
      warning={sizeWarning(input)}
      actions={
        <>
          <ToolActionButton onClick={handleFormat}>Format</ToolActionButton>
          <ToolActionButton variant="outline" onClick={handleCopy} disabled={!output}>
            Copy
          </ToolActionButton>
          <ToolActionButton variant="ghost" onClick={handleClear}>
            Clear
          </ToolActionButton>
        </>
      }
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 md:grid-cols-2">
        <ToolTextarea
          label="Input"
          tone="sky"
          placeholder='{"hello":"world"}'
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <ToolTextarea
          label="Output"
          tone="emerald"
          readOnly
          placeholder="Formatted JSON appears here"
          value={output}
        />
      </div>
    </ToolPane>
  )
}
