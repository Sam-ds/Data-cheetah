import JSZip from 'jszip'
import type { DashboardPack, DashboardSampleFile } from '@/types/dashboardPack'
import { normalizeSamples } from '@/types/dashboardPack'
import { parseDashboardPack } from './parseDashboardPack'
import { db } from '@/lib/db/dexie'

const MAX_VISUALIZATION_JS_BYTES = 256 * 1024

function stem(name: string): string {
  return name.replace(/\.csv$/i, '')
}

export async function packToZipBlob(pack: DashboardPack): Promise<Blob> {
  const zip = new JSZip()
  zip.file('meta.json', JSON.stringify(pack.meta, null, 2))
  zip.file('rule.json', JSON.stringify(pack.rule, null, 2))
  if (pack.visualizationJs) {
    zip.file('visualization.js', pack.visualizationJs)
  }
  const samples = normalizeSamples(pack)
  if (samples.length === 1 && samples[0].name === 'sample') {
    zip.file('sample.csv', samples[0].csv)
  } else if (samples.length) {
    const folder = zip.folder('samples')
    const index: string[] = []
    const bundle: Record<string, string> = {}
    for (const s of samples) {
      const name = `${stem(s.name)}.csv`
      folder?.file(name, s.csv)
      index.push(name)
      bundle[stem(s.name)] = s.csv
    }
    folder?.file('index.json', JSON.stringify(index, null, 2))
    zip.file('samples-bundle.json', JSON.stringify(bundle))
  }
  return zip.generateAsync({ type: 'blob' })
}

export function downloadPackZip(pack: DashboardPack): Promise<void> {
  return packToZipBlob(pack).then((blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pack.meta.id || 'dashboard'}.datacheetah-dashboard.zip`
    a.click()
    URL.revokeObjectURL(url)
  })
}

async function samplesFromZip(zip: JSZip): Promise<DashboardSampleFile[]> {
  const out: DashboardSampleFile[] = []
  const rootSample = zip.file('sample.csv')
  if (rootSample) {
    out.push({ name: 'sample', csv: await rootSample.async('string') })
  }
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const m = path.match(/^samples\/([^/]+)\.csv$/i)
    if (m) {
      out.push({ name: stem(m[1]), csv: await entry.async('string') })
    }
  }
  // Also accept sample-*.csv at root
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const m = path.match(/^sample-([^/]+)\.csv$/i)
    if (m) {
      out.push({ name: stem(m[1]), csv: await entry.async('string') })
    }
  }
  return out
}

function assertNoExecutableEntries(zip: JSZip): void {
  const executable = Object.keys(zip.files).find((name) =>
    name !== 'visualization.js' && /\.(?:js|mjs|cjs|jsx|ts|tsx|vue|html?)$/i.test(name),
  )
  if (executable) {
    throw new Error(
      `Only the sandboxed visualization.js entry is allowed (${executable} is unsupported).`,
    )
  }
}

async function visualizationFromZip(zip: JSZip): Promise<string | undefined> {
  const entry = zip.file('visualization.js')
  if (!entry) return undefined
  const source = await entry.async('string')
  const size = new TextEncoder().encode(source).byteLength
  if (size > MAX_VISUALIZATION_JS_BYTES) {
    throw new Error('visualization.js exceeds the 256 KB limit')
  }
  if (!source.trim()) throw new Error('visualization.js cannot be empty')
  return source
}

export async function readPackFromZip(file: File): Promise<DashboardPack> {
  const zip = await JSZip.loadAsync(file)
  assertNoExecutableEntries(zip)
  const metaFile = zip.file('meta.json')
  const ruleFile = zip.file('rule.json')
  if (!metaFile || !ruleFile) {
    throw new Error('Pack must include meta.json and rule.json')
  }
  const meta = JSON.parse(await metaFile.async('string')) as unknown
  const rule = JSON.parse(await ruleFile.async('string')) as unknown
  const samples = await samplesFromZip(zip)
  const visualizationJs = await visualizationFromZip(zip)
  return parseDashboardPack({
    meta,
    rule,
    samples: samples.length ? samples : undefined,
    visualizationJs,
    source: 'installed',
  })
}

export async function readPackFromFiles(files: {
  meta: File
  rule: File
  sample?: File
  samples?: File[]
}): Promise<DashboardPack> {
  const meta = JSON.parse(await files.meta.text()) as unknown
  const rule = JSON.parse(await files.rule.text()) as unknown
  const samples: DashboardSampleFile[] = []
  if (files.samples?.length) {
    for (const f of files.samples) {
      samples.push({ name: stem(f.name), csv: await f.text() })
    }
  } else if (files.sample) {
    samples.push({ name: 'sample', csv: await files.sample.text() })
  }
  return parseDashboardPack({
    meta,
    rule,
    samples: samples.length ? samples : undefined,
    source: 'installed',
  })
}

export async function saveInstalledPack(pack: DashboardPack): Promise<void> {
  const samples = normalizeSamples(pack)
  await db.dashboardPacks.put({
    id: pack.meta.id,
    metaJson: JSON.stringify(pack.meta),
    ruleJson: JSON.stringify(pack.rule),
    sampleCsv: samples[0]?.csv,
    samplesJson: samples.length ? JSON.stringify(samples) : undefined,
    visualizationJs: pack.visualizationJs,
    installedAt: new Date(),
  })
}

export async function listInstalledPacks(): Promise<DashboardPack[]> {
  const rows = await db.dashboardPacks.toArray()
  return rows.map((row) => {
    let samples: DashboardSampleFile[] | undefined
    if (row.samplesJson) {
      try {
        samples = JSON.parse(row.samplesJson) as DashboardSampleFile[]
      } catch {
        samples = undefined
      }
    }
    return parseDashboardPack({
      meta: JSON.parse(row.metaJson) as unknown,
      rule: JSON.parse(row.ruleJson) as unknown,
      sampleCsv: row.sampleCsv,
      samples,
      visualizationJs: row.visualizationJs,
      source: 'installed',
    })
  })
}

export async function deleteInstalledPack(id: string): Promise<void> {
  await db.dashboardPacks.delete(id)
}

async function readJsonResponse(res: Response, label: string): Promise<unknown> {
  const text = await res.text()
  const trimmed = text.replace(/^\uFEFF/, '').trimStart()
  if (!trimmed || isHtmlLike(trimmed)) {
    throw new Error(`Could not load ${label} (got HTML instead of JSON)`)
  }
  try {
    return JSON.parse(text.replace(/^\uFEFF/, '')) as unknown
  } catch {
    throw new Error(`Could not load ${label} (invalid JSON)`)
  }
}

function isHtmlLike(text: string): boolean {
  const t = text.replace(/^\uFEFF/, '').trimStart().toLowerCase()
  return (
    t.startsWith('<!doctype') ||
    t.startsWith('<html') ||
    t.startsWith('<head') ||
    t.startsWith('<body') ||
    (t.startsWith('<') && t.includes('</html>'))
  )
}

function isCsvLike(text: string): boolean {
  const t = text.replace(/^\uFEFF/, '').trimStart()
  if (!t || isHtmlLike(t)) return false
  // header row with a comma, or at least one newline of tabular text
  const first = t.split(/\r?\n/).find((l) => l.trim()) ?? ''
  return first.includes(',') || first.includes('\t')
}

async function tryFetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const text = await res.text()
    if (!text.replace(/^\uFEFF/, '').trim() || isHtmlLike(text)) return null
    return text.replace(/^\uFEFF/, '')
  } catch {
    return null
  }
}

async function tryReadJsonObject(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.ok) return null
  const text = await res.text()
  const trimmed = text.replace(/^\uFEFF/, '').trimStart()
  if (!trimmed || isHtmlLike(trimmed) || trimmed[0] !== '{') return null
  try {
    const parsed = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

async function tryReadJsonArray(res: Response): Promise<unknown[] | null> {
  if (!res.ok) return null
  const text = await res.text()
  const trimmed = text.replace(/^\uFEFF/, '').trimStart()
  if (!trimmed || isHtmlLike(trimmed) || trimmed[0] !== '[') return null
  try {
    const parsed = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function loadBundledSamples(
  basePath: string,
  rule: unknown,
): Promise<DashboardSampleFile[]> {
  const byName = new Map<string, DashboardSampleFile>()

  const add = (name: string, csv: string) => {
    const key = stem(name)
    if (!csv.trim() || isHtmlLike(csv) || byName.has(key)) return
    // Allow non-CSV only for empty check; prefer csv-like for data files
    if (key !== 'sample' && !isCsvLike(csv)) return
    if (key === 'sample' && isHtmlLike(csv)) return
    byName.set(key, { name: key, csv: csv.replace(/\r\n/g, '\n') })
  }

  // 1) Preferred: single samples-bundle.json (SPA-safe)
  const bundleRes = await fetch(`${basePath}/samples-bundle.json`)
  const bundle = await tryReadJsonObject(bundleRes)
  if (bundle) {
    for (const [name, value] of Object.entries(bundle)) {
      if (typeof value === 'string') add(name, value)
    }
  }

  // 2) Root sample.csv
  const rootCsv = await tryFetchText(`${basePath}/sample.csv`)
  if (rootCsv && isCsvLike(rootCsv)) add('sample', rootCsv)

  // 3) samples/index.json list
  const indexRes = await fetch(`${basePath}/samples/index.json`)
  const list = await tryReadJsonArray(indexRes)
  if (list?.length) {
    await Promise.all(
      list.map(async (item) => {
        const fileName = String(item)
        const csvName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
        const csv = await tryFetchText(`${basePath}/samples/${csvName}`)
        if (csv && isCsvLike(csv)) add(stem(csvName), csv)
      }),
    )
  }

  // 4) Always also try rule.tables files (covers missing index)
  const ruleObj = rule as { tables?: { file?: string; id?: string }[] }
  if (Array.isArray(ruleObj.tables)) {
    await Promise.all(
      ruleObj.tables.map(async (t) => {
        const file = String(t.file ?? t.id ?? '')
        if (!file) return
        const csvName = file.endsWith('.csv') ? file : `${file}.csv`
        const csv = await tryFetchText(`${basePath}/samples/${csvName}`)
        if (csv && isCsvLike(csv)) add(stem(csvName), csv)
      }),
    )
  }

  return [...byName.values()]
}

export async function fetchBundledPack(basePath: string): Promise<DashboardPack> {
  const [metaRes, ruleRes] = await Promise.all([
    fetch(`${basePath}/meta.json`),
    fetch(`${basePath}/rule.json`),
  ])
  if (!metaRes.ok || !ruleRes.ok) {
    throw new Error(`Could not load template from ${basePath}`)
  }
  const meta = await readJsonResponse(metaRes, 'meta.json')
  const rule = await readJsonResponse(ruleRes, 'rule.json')
  const samples = await loadBundledSamples(basePath, rule)
  const ruleObject = rule as { dynamic?: { visualizationId?: unknown } }
  const visualizationJs =
    ruleObject.dynamic?.visualizationId === 'pack'
      ? await tryFetchText(`${basePath}/visualization.js`)
      : undefined

  return parseDashboardPack({
    meta,
    rule,
    samples: samples.length ? samples : undefined,
    visualizationJs: visualizationJs ?? undefined,
    source: 'bundled',
  })
}
