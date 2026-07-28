import { useCallback, useEffect, useState } from 'react'
import { Check, Folder, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  createWorkspace,
  deleteWorkspace,
  ensureDefaultWorkspace,
  listWorkspaces,
  renameWorkspace,
} from '@/features/workspace/services/workspaceService'
import { switchWorkspace } from '@/features/files/services/localDatasetService'
import type { LocalWorkspace } from '@/types/workspace'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<LocalWorkspace[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const ws = await ensureDefaultWorkspace()
    const all = await listWorkspaces()
    setWorkspaces(all)
    setActiveId(ws.id)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0]

  const onSwitch = async (id: string) => {
    if (id === activeId || busy) return
    setBusy(true)
    try {
      const n = await switchWorkspace(id)
      setActiveId(id)
      await refresh()
      toast.success(
        n > 0
          ? `Switched workspace · ${n} dataset${n === 1 ? '' : 's'} loaded`
          : 'Switched workspace (empty)',
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not switch workspace')
    } finally {
      setBusy(false)
    }
  }

  const onCreate = async () => {
    const name = window.prompt('New workspace name', 'Workspace')
    if (!name?.trim()) return
    setBusy(true)
    try {
      const ws = await createWorkspace(name)
      const n = await switchWorkspace(ws.id)
      await refresh()
      toast.success(
        n > 0 ? `Created “${ws.name}”` : `Created “${ws.name}” — open files to get started`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create workspace')
    } finally {
      setBusy(false)
    }
  }

  const onRename = async () => {
    if (!active) return
    const name = window.prompt('Rename workspace', active.name)
    if (!name?.trim()) return
    await renameWorkspace(active.id, name)
    await refresh()
    toast.success('Workspace renamed')
  }

  const onDelete = async () => {
    if (!active) return
    if (workspaces.length <= 1) {
      toast.error('Keep at least one workspace')
      return
    }
    const ok = window.confirm(
      `Delete workspace “${active.name}” and all its cached datasets? This cannot be undone.`,
    )
    if (!ok) return
    setBusy(true)
    try {
      const nextId = await deleteWorkspace(active.id)
      if (nextId) {
        await switchWorkspace(nextId)
      }
      await refresh()
      toast.success(`Deleted “${active.name}”`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete workspace')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-[10rem] gap-1.5"
          disabled={busy}
          title="Local workspace"
        >
          <Folder className="h-3.5 w-3.5 shrink-0 text-[#f2a01f]" />
          <span className="truncate">{active?.name ?? 'Workspace'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Local workspaces
        </p>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={() => void onSwitch(w.id)}
            className={cn('gap-2', w.id === activeId && 'bg-accent')}
          >
            {w.id === activeId ? (
              <Check className="h-3.5 w-3.5 text-[#f2a01f]" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-[#f2a01f]/80" />
            )}
            <span className="truncate">{w.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void onCreate()} className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          New workspace
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void onRename()} disabled={!active}>
          Rename…
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void onDelete()}
          disabled={!active || workspaces.length <= 1}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete workspace…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
