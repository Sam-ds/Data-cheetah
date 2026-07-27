import { useRef, useState } from 'react'
import {
  Play,
  FileUp,
  AlignLeft,
  Download,
  PanelLeft,
  Bookmark,
  Keyboard,
  Wrench,
} from 'lucide-react'
import logo from '@/assets/logo.png'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useSqlEditor } from '@/features/sql/hooks/useSqlEditor'
import { useFileImport } from '@/features/files/hooks/useFileImport'
import { useFilesStore } from '@/features/files/store/filesStore'
import { useQueryStore } from '@/features/sql/store/sqlStore'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { useToolsStore, TOOL_LABELS, type ToolId } from '@/features/tools/store/toolsStore'
import { exportToCsv, exportToXlsx } from '@/services/exportService'
import { SavedQueriesDialog } from '@/features/sql/components/SavedQueriesDialog'
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog'
import { goHome } from '@/features/workspace/goHome'

const TOOL_MENU: ToolId[] = ['json-format', 'json-minify', 'json-compare', 'text-compare']

export function TopToolbar() {
  const { runQuery, formatSql, isRunning } = useSqlEditor()
  const { handleFileInput } = useFileImport()
  const hasFiles = useFilesStore((s) => s.files.length > 0)
  const result = useQueryStore((s) => s.result)
  const { toggleSidebar } = useWorkspaceStore()
  const openTool = useToolsStore((s) => s.openTool)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-background px-3">
        <button
          type="button"
          onClick={goHome}
          className="flex items-center rounded-sm pr-3 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#f2a01f]/40"
          title="Back to home"
          aria-label="DataCheetah home"
        >
          <img
            src={logo}
            alt="DataCheetah"
            className="h-9 w-auto rounded-sm object-contain"
          />
        </button>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
          <FileUp className="h-3.5 w-3.5" />
          Open
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.tsv,.parquet,.json,.jsonl,.xlsx,.xls"
          onChange={handleFileInput}
        />

        {hasFiles && (
          <>
            <Button variant="default" size="sm" onClick={runQuery} disabled={isRunning}>
              <Play className="h-3.5 w-3.5" />
              {isRunning ? 'Running...' : 'Run'}
            </Button>

            <Button variant="ghost" size="sm" onClick={formatSql}>
              <AlignLeft className="h-3.5 w-3.5" />
              Format
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={!result}>
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => result && exportToCsv(result)}>
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => result && exportToXlsx(result)}>
                  Export Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <Button variant="ghost" size="sm" onClick={() => setSavedOpen(true)}>
              <Bookmark className="h-3.5 w-3.5" />
              Saved
            </Button>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Wrench className="h-3.5 w-3.5" />
              Tools
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TOOL_MENU.map((id) => (
              <DropdownMenuItem key={id} onClick={() => openTool(id)}>
                {TOOL_LABELS[id]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <Button variant="ghost" size="icon" onClick={() => setShortcutsOpen(true)}>
          <Keyboard className="h-3.5 w-3.5" />
        </Button>

        {hasFiles && (
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <PanelLeft className="h-3.5 w-3.5" />
          </Button>
        )}

        <ThemeToggle />
      </header>

      <SavedQueriesDialog open={savedOpen} onOpenChange={setSavedOpen} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}
