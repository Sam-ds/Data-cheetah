import * as XLSX from 'xlsx'
import { duckdbClient } from '@/services/duckdbClient'
import { db } from '@/lib/db/dexie'
import { detectFormat, generateId, isSupportedFile, sanitizeTableName } from '@/lib/utils/sanitizeTableName'
import { normalizeJsonForImport } from '@/features/files/services/normalizeJsonForImport'
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

export async function importFile(file: File): Promise<RegisteredDataset> {
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

  const tableName = sanitizeTableName(file.name)
  const result = await duckdbClient.registerFile(registerName, buffer, format, tableName)

  const dataset: RegisteredDataset = {
    id: generateId(),
    fileName: file.name,
    fileSize: file.size,
    format,
    tableName: result.tableName,
    schema: result.schema,
    rowCount: result.rowCount,
    registeredAt: new Date(),
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

  return dataset
}

export function validateFile(file: File): boolean {
  return isSupportedFile(file.name)
}

export { detectFormat }
