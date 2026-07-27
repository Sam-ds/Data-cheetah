import { db } from '@/lib/db/dexie'
import type { LocalWorkspace } from '@/types/workspace'
import { DEFAULT_WORKSPACE_NAME } from '@/types/workspace'
import { clearPersistedDatasetsForWorkspace } from '@/features/files/services/datasetPersistenceService'

const ACTIVE_WS_KEY = 'datacheetah-active-workspace'

export function getActiveWorkspaceIdSync(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WS_KEY)
  } catch {
    return null
  }
}

export function setActiveWorkspaceIdSync(id: string): void {
  try {
    localStorage.setItem(ACTIVE_WS_KEY, id)
  } catch {
    /* ignore */
  }
}

function normalize(ws: LocalWorkspace): LocalWorkspace {
  return {
    ...ws,
    createdAt: ws.createdAt instanceof Date ? ws.createdAt : new Date(ws.createdAt),
    updatedAt: ws.updatedAt instanceof Date ? ws.updatedAt : new Date(ws.updatedAt),
  }
}

export async function listWorkspaces(): Promise<LocalWorkspace[]> {
  const rows = await db.workspaces.orderBy('updatedAt').reverse().toArray()
  return rows.map(normalize)
}

export async function getWorkspace(id: string): Promise<LocalWorkspace | undefined> {
  const row = await db.workspaces.get(id)
  return row ? normalize(row) : undefined
}

export async function ensureDefaultWorkspace(): Promise<LocalWorkspace> {
  const existing = await db.workspaces.toArray()
  if (existing.length > 0) {
    const activeId = getActiveWorkspaceIdSync()
    if (activeId && existing.some((w) => w.id === activeId)) {
      return normalize(existing.find((w) => w.id === activeId)!)
    }
    const first = normalize(existing[0])
    setActiveWorkspaceIdSync(first.id)
    return first
  }

  const ws: LocalWorkspace = {
    id: crypto.randomUUID(),
    name: DEFAULT_WORKSPACE_NAME,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.workspaces.put(ws)
  setActiveWorkspaceIdSync(ws.id)
  return ws
}

export async function createWorkspace(name: string): Promise<LocalWorkspace> {
  const trimmed = name.trim() || 'Workspace'
  const ws: LocalWorkspace = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.workspaces.put(ws)
  return ws
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  const existing = await db.workspaces.get(id)
  if (!existing) return
  await db.workspaces.put({
    ...existing,
    name: name.trim() || existing.name,
    updatedAt: new Date(),
  })
}

export async function deleteWorkspace(id: string): Promise<string | null> {
  await clearPersistedDatasetsForWorkspace(id)
  await db.workspaces.delete(id)

  const remaining = await listWorkspaces()
  if (remaining.length === 0) {
    const fresh = await ensureDefaultWorkspace()
    return fresh.id
  }

  const active = getActiveWorkspaceIdSync()
  if (active === id) {
    setActiveWorkspaceIdSync(remaining[0].id)
    return remaining[0].id
  }
  return active
}

export async function touchWorkspace(id: string): Promise<void> {
  const existing = await db.workspaces.get(id)
  if (!existing) return
  await db.workspaces.put({ ...existing, updatedAt: new Date() })
}
