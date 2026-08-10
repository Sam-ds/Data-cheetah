import * as XLSX from 'xlsx'
import { duckdbClient } from '@/services/duckdbClient'
import { db } from '@/lib/db/dexie'
import { detectFormat, generateId, isSupportedFile, sanitizeTableName } from '@/lib/utils/sanitizeTableName'
import { normalizeJsonForImport } from '@/features/files/services/normalizeJsonForImport'
import {
  findPersistedDatasetForUpdate,
  savePersistedDataset,
} from '@/features/files/services/datasetPersistenceService'
import {
  ensureDefaultWorkspace,
  getActiveWorkspaceIdSync,
  touchWorkspace,
} from '@/features/workspace/services/workspaceService'
import type { RegisteredDataset } from '@/types/dataset'

async function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer()
}

async function readFileAsText(file: File): Promise<string> {
  return file.text()
}

async function convertXlsxToCsvBuffer(file: File): Promise<{ buffer: ArrayBuffer; name: string }> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const csv = XLSX.utils.sheet_to_csv(firstSheet)
  const encoder = new TextEncoder()
  const buffer = encoder.encode(csv).buffer as ArrayBuffer
  const name = file.name.replace(/\.xlsx?$/i, '.csv')
  return { buffer, name }
}

async function prepareImportBuffer(file: File): Promise<{
  buffer: ArrayBuffer
  registerName: string
  format: NonNullable<ReturnType<typeof detectFormat>>
}> {
  const format = detectFormat(file.name)
  if (!format) {
    throw new Error(`Unsupported file format: ${file.name}`)
  }

  let buffer: ArrayBuffer
  let registerName = file.name

  if (format === 'xlsx') {
    const converted = await convertXlsxToCsvBuffer(file)
    buffer = converted.buffer
    registerName = converted.name
  } else if (format === 'json') {
    const text = await readFileAsText(file)
    const normalized = normalizeJsonForImport(text, file.name)
    buffer = normalized.buffer
    registerName = normalized.registerName
  } else {
    buffer = await readFileAsBuffer(file)
  }

  return { buffer, registerName, format }
}

export async function importFile(file: File): Promise<RegisteredDataset & { replaced?: boolean }> {
  const { buffer, registerName, format } = await prepareImportBuffer(file)

  const tableName = sanitizeTableName(file.name)
  const result = await duckdbClient.registerFile(registerName, buffer, format, tableName)

  const workspace = await ensureDefaultWorkspace()
  const workspaceId = getActiveWorkspaceIdSync() ?? workspace.id

  // Same table/file in this workspace → replace (update) instead of duplicating
  const existing = await findPersistedDatasetForUpdate(workspaceId, result.tableName, file.name)
  const id = existing?.id ?? generateId()
  const replaced = Boolean(existing)

  const dataset: RegisteredDataset & { replaced?: boolean } = {
    id,
    fileName: file.name,
    fileSize: file.size,
    format,
    tableName: result.tableName,
    schema: result.schema,
    rowCount: result.rowCount,
    registeredAt: new Date(),
    schemaDoc: existing?.schemaDoc,
    replaced,
  }

  await db.recentFiles.put({
    id: dataset.id,
    fileName: dataset.fileName,
    format: dataset.format,
    tableName: dataset.tableName,
    fileSize: dataset.fileSize,
    columnCount: dataset.schema.length,
    rowCount: dataset.rowCount,
    lastOpenedAt: new Date(),
  })

  try {
    await savePersistedDataset({
      id: dataset.id,
      workspaceId,
      fileName: dataset.fileName,
      registerName,
      format: dataset.format,
      tableName: dataset.tableName,
      schema: dataset.schema,
      rowCount: dataset.rowCount,
      fileSize: dataset.fileSize,
      buffer,
      schemaDoc: existing?.schemaDoc,
      savedAt: new Date(),
    })
    await touchWorkspace(workspaceId)
  } catch (err) {
    console.warn('Could not persist dataset locally', err)
    dataset.persistWarning =
      err instanceof Error ? err.message : 'Could not save dataset for next refresh (storage full?)'
  }

  return dataset
}

/**
 * Register a file in DuckDB for this session only (Discover templates / BYOD).
 * Does not write to IndexedDB, recent files, or the Explore workspace library.
 */
export async function importFileEphemeral(
  file: File,
  preferredTableName?: string,
): Promise<{ tableName: string; schema: RegisteredDataset['schema']; rowCount: number }> {
  const { buffer, registerName, format } = await prepareImportBuffer(file)
  const base = preferredTableName
    ? sanitizeTableName(`${preferredTableName}.csv`)
    : sanitizeTableName(file.name)
  const tableName = base.startsWith('discover_') ? base : `discover_${base}`
  return duckdbClient.registerFile(registerName, buffer, format, tableName)
}

export function validateFile(file: File): boolean {
  return isSupportedFile(file.name)
}

export { detectFormat }
