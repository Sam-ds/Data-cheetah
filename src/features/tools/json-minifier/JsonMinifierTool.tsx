import { useState } from 'react'
import { toast } from 'sonner'
import { minifyJson } from './minifyJson'
import {
  ToolPane,
  ToolTextarea,
  ToolActionButton,
  copyText,
  sizeWarning,
} from '../components/ToolPane'

export function JsonMinifierTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleMinify = () => {
    const result = minifyJson(input)
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
    toast[ok ? 'success' : 'error'](ok ? 'Copied minified JSON' : 'Copy failed')
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
    setError(null)
  }

  return (
    <ToolPane
      title="JSON Minifier"
      description="Collapse JSON to a single line. Runs entirely in your browser."
      error={error}
      warning={sizeWarning(input)}
      actions={
        <>
          <ToolActionButton onClick={handleMinify}>Minify</ToolActionButton>
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
          placeholder={'{\n  "hello": "world"\n}'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <ToolTextarea
          label="Output"
          readOnly
          placeholder="Minified JSON appears here"
          value={output}
          className="whitespace-pre-wrap break-all"
        />
      </div>
    </ToolPane>
  )
}
