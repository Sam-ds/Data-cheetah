import { db } from '@/lib/db/dexie'
import { decryptBytes, encryptBytes } from '@/lib/crypto/originVault'
import type { PersistedDataset } from '@/types/persistedDataset'
import type { TableSchemaDoc } from '@/types/schemaDoc'

function normalize(row: PersistedDataset): PersistedDataset {
  return {
    ...row,
    savedAt: row.savedAt instanceof Date ? row.savedAt : new Date(row.savedAt),
  }
}

export async function savePersistedDataset(record: PersistedDataset): Promise<void> {
  const { iv, ciphertext } = await encryptBytes(record.buffer, 'dataset-blob', record.id)
  await db.datasetBlobs.put({
    ...record,
    buffer: ciphertext,
    crypto: { v: 1, iv },
    savedAt: record.savedAt instanceof Date ? record.savedAt : new Date(record.savedAt),
  })
}

/** Decrypt persisted bytes for DuckDB. Re-encrypts leftover plaintext on first read. */
export async function unwrapDatasetBuffer(row: PersistedDataset): Promise<ArrayBuffer> {
  if (row.crypto?.v === 1 && row.crypto.iv) {
    return decryptBytes(row.crypto.iv, row.buffer, 'dataset-blob', row.id)
  }
  const plain = row.buffer
  void savePersistedDataset({ ...row, buffer: plain }).catch(() => {
    /* keep plaintext until the next successful save */
  })
  return plain
}

export async function listPersistedDatasets(workspaceId?: string): Promise<PersistedDataset[]> {
  if (workspaceId) {
    const rows = await db.datasetBlobs.where('workspaceId').equals(workspaceId).sortBy('savedAt')
    return rows.map(normalize)
  }
  const rows = await db.datasetBlobs.orderBy('savedAt').toArray()
  return rows.map(normalize)
}

export async function countPersistedDatasets(workspaceId?: string): Promise<number> {
  if (workspaceId) {
    return db.datasetBlobs.where('workspaceId').equals(workspaceId).count()
  }
  return db.datasetBlobs.count()
}

export async function loadPersistedDataset(id: string): Promise<PersistedDataset | undefined> {
  const row = await db.datasetBlobs.get(id)
  return row ? normalize(row) : undefined
}

/** Find existing dataset in a workspace by DuckDB table name or file name (for updates). */
export async function findPersistedDatasetForUpdate(
  workspaceId: string,
  tableName: string,
  fileName: string,
): Promise<PersistedDataset | undefined> {
  const rows = await db.datasetBlobs.where('workspaceId').equals(workspaceId).toArray()
  const byTable = rows.find((r) => r.tableName.toLowerCase() === tableName.toLowerCase())
  if (byTable) return normalize(byTable)
  const byFile = rows.find((r) => r.fileName.toLowerCase() === fileName.toLowerCase())
  return byFile ? normalize(byFile) : undefined
}

export async function updatePersistedSchemaDoc(
  id: string,
  schemaDoc: TableSchemaDoc | undefined,
): Promise<void> {
  const existing = await db.datasetBlobs.get(id)
  if (!existing) return
  if (schemaDoc === undefined) {
    delete existing.schemaDoc
    await db.datasetBlobs.put(existing)
  } else {
    await db.datasetBlobs.put({ ...existing, schemaDoc, savedAt: new Date() })
  }
}

export async function deletePersistedDataset(id: string): Promise<void> {
  await db.datasetBlobs.delete(id)
  await db.recentFiles.delete(id)
}

export async function clearPersistedDatasetsForWorkspace(workspaceId: string): Promise<void> {
  const rows = await db.datasetBlobs.where('workspaceId').equals(workspaceId).primaryKeys()
  await db.datasetBlobs.where('workspaceId').equals(workspaceId).delete()
  if (rows.length) {
    await db.recentFiles.bulkDelete(rows as string[])
  }
}

export async function clearPersistedDatasets(): Promise<void> {
  const ids = await db.datasetBlobs.toCollection().primaryKeys()
  await db.datasetBlobs.clear()
  if (ids.length) {
    await db.recentFiles.bulkDelete(ids as string[])
  }
}
