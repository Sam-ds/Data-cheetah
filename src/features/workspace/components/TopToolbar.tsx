import { useRef, useState } from 'react'
import {
  Play,
  FileUp,
  AlignLeft,
  Download,
  PanelLeft,
  Bookmark,
  Keyboard,
  Trash2,
  Database,
  Braces,
  Home,
  Settings,
  FolderOpen,
  Compass,
  ArrowLeft,
  Code2,
  PawPrint,
} from 'lucide-react'
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
import { useToolsStore } from '@/features/tools/store/toolsStore'
import { exportToCsv, exportToXlsx } from '@/services/exportService'
import { SavedQueriesDialog } from '@/features/sql/components/SavedQueriesDialog'
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog'
import { ExportNameDialog } from '@/components/ExportNameDialog'
import { WorkspaceSwitcher } from '@/features/workspace/components/WorkspaceSwitcher'
import { goHome } from '@/features/workspace/goHome'
import { clearLocalDatasets } from '@/features/files/services/localDatasetService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

export function TopToolbar() {
  const appMode = useWorkspaceStore((s) => s.appMode)
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const { runQuery, formatSql, isRunning } = useSqlEditor()
  const { handleFileInput, handleFolderInput } = useFileImport()
  const hasFiles = useFilesStore((s) => s.files.length > 0)
  const result = useQueryStore((s) => s.result)
  const { toggleSidebar } = useWorkspaceStore()
  const closeTools = useToolsStore((s) => s.close)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | null>(null)

  const isExplore = appMode === 'explore'

  const handleClearLocal = async () => {
    const ok = window.confirm(
      'Clear all cached datasets in this workspace? Theme and saved SQL queries are kept. Other workspaces are unchanged.',
    )
    if (!ok) return
    setClearing(true)
    try {
      await clearLocalDatasets()
      toast.success('Workspace datasets cleared')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not clear local data')
    } finally {
      setClearing(false)
    }
  }

  const enterExplore = () => {
    closeTools()
    setAppMode('explore')
  }

  const enterDiscover = () => {
    closeTools()
    setAppMode('discover')
  }

  const enterTools = () => {
    closeTools()
    setAppMode('tools')
  }

  const enterSettings = () => {
    closeTools()
    setAppMode('settings')
  }

  const enterTemplateDesign = () => {
    closeTools()
    setAppMode('template-design')
  }

  return (
    <>
      <header className="app-top-toolbar flex h-12 shrink-0 items-center gap-1 px-3">
        <button
          type="button"
          onClick={goHome}
          className="flex items-center rounded-sm pr-2 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#f2a01f]/40"
          title="Home"
          aria-label="DataCheetah home"
        >
          <span className="app-toolbar-brand" aria-hidden>
            <span className="app-toolbar-brand-data">data</span>
            <span className="app-toolbar-brand-cheetah">
              <span className="cheetah-word">cheetah</span>
              <PawPrint className="cheetah-paw cheetah-paw--toolbar" strokeWidth={2.4} />
            </span>
          </span>
        </button>

        {/* Explore: no Home / Tools nav — logo returns home */}
        {!isExplore && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <nav className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(appMode === 'home' && 'bg-accent')}
                onClick={goHome}
              >
                <Home className="h-3.5 w-3.5" />
                Home
              </Button>
              <Button variant="ghost" size="sm" onClick={enterExplore}>
                <Database className="h-3.5 w-3.5" />
                Explore
              </Button>
              <button
                type="button"
                className={cn(
                  'home-hero-discover app-toolbar-discover',
                  appMode === 'discover' && 'app-toolbar-discover--active',
                )}
                onClick={enterDiscover}
              >
                <Compass className="home-hero-discover-icon" aria-hidden />
                Discover
              </button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(appMode === 'tools' && 'bg-accent')}
                onClick={() => enterTools()}
              >
                <Braces className="h-3.5 w-3.5" />
                Tools
              </Button>
            </nav>
          </>
        )}

        {isExplore && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <Button variant="ghost" size="sm" onClick={goHome} title="Back to home">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <WorkspaceSwitcher />
            <Separator orientation="vertical" className="mx-1 h-5" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <FileUp className="h-3.5 w-3.5" />
                  Open
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="h-3.5 w-3.5" />
                  Files…
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => folderInputRef.current?.click()}
                  title="Read a local folder in the browser. Nothing is uploaded."
                >
                  <FolderOpen className="h-3.5 w-3.5 text-[#f2a01f]" />
                  Folder (on this device)…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.tsv,.parquet,.json,.jsonl,.xlsx,.xls,.schema.json"
              multiple
              onChange={handleFileInput}
            />
            <input
              ref={(el) => {
                folderInputRef.current = el
                if (el) {
                  el.setAttribute('webkitdirectory', '')
                  el.setAttribute('directory', '')
                }
              }}
              type="file"
              className="hidden"
              multiple
              onChange={handleFolderInput}
            />

            <Button
              variant="default"
              size="sm"
              onClick={runQuery}
              disabled={isRunning || !hasFiles}
            >
              <Play className="h-3.5 w-3.5" />
              {isRunning ? 'Running...' : 'Run'}
            </Button>

            <Button variant="ghost" size="sm" onClick={formatSql} disabled={!hasFiles}>
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
                <DropdownMenuItem onClick={() => result && setExportFormat('csv')}>
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => result && setExportFormat('xlsx')}>
                  Export Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={() => setSavedOpen(true)}>
              <Bookmark className="h-3.5 w-3.5" />
              Saved
            </Button>
          </>
        )}

        <div className="flex-1" />

        {isExplore && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={clearing}
              onClick={() => void handleClearLocal()}
              title="Remove cached datasets in this workspace"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {clearing ? 'Clearing…' : 'Clear local'}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleSidebar} title="Toggle files sidebar">
              <PanelLeft className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        <button
          type="button"
          className={cn(
            'home-hero-discover app-toolbar-discover',
            appMode === 'template-design' && 'app-toolbar-discover--active',
          )}
          onClick={enterTemplateDesign}
        >
          <Code2 className="home-hero-discover-icon" aria-hidden />
          For developers
        </button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(appMode === 'settings' && 'bg-accent')}
          onClick={enterSettings}
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Button>

        <Button variant="ghost" size="icon" onClick={() => setShortcutsOpen(true)}>
          <Keyboard className="h-3.5 w-3.5" />
        </Button>

        <ThemeToggle />
      </header>

      <SavedQueriesDialog open={savedOpen} onOpenChange={setSavedOpen} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ExportNameDialog
        open={!!exportFormat}
        format={exportFormat}
        defaultName="export"
        onOpenChange={(open) => {
          if (!open) setExportFormat(null)
        }}
        onConfirm={(fileName) => {
          if (!result || !exportFormat) return
          if (exportFormat === 'csv') exportToCsv(result, fileName)
          else exportToXlsx(result, fileName)
        }}
      />
    </>
  )
}
