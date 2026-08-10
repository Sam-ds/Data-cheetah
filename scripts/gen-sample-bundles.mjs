/**
 * Build samples-bundle.json for each template (avoids SPA HTML fallbacks on per-file CSV fetch).
 * Run: node scripts/gen-sample-bundles.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = path.join(root, 'public', 'templates')

function isHtmlLike(text) {
  const t = text.replace(/^\uFEFF/, '').trimStart().toLowerCase()
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.startsWith('<head')
}

for (const id of fs.readdirSync(base)) {
  const dir = path.join(base, id)
  if (!fs.statSync(dir).isDirectory()) continue
  if (!fs.existsSync(path.join(dir, 'meta.json'))) continue

  /** @type {Record<string, string>} */
  const bundle = {}

  const rootSample = path.join(dir, 'sample.csv')
  if (fs.existsSync(rootSample)) {
    const csv = fs.readFileSync(rootSample, 'utf8')
    if (csv.trim() && !isHtmlLike(csv)) bundle.sample = csv.replace(/\r\n/g, '\n')
  }

  const samplesDir = path.join(dir, 'samples')
  if (fs.existsSync(samplesDir)) {
    for (const name of fs.readdirSync(samplesDir)) {
      if (!name.toLowerCase().endsWith('.csv')) continue
      const csv = fs.readFileSync(path.join(samplesDir, name), 'utf8')
      if (!csv.trim() || isHtmlLike(csv)) continue
      const stem = name.replace(/\.csv$/i, '')
      bundle[stem] = csv.replace(/\r\n/g, '\n')
    }
  }

  if (!Object.keys(bundle).length) {
    console.warn('no samples for', id)
    continue
  }

  fs.writeFileSync(path.join(dir, 'samples-bundle.json'), JSON.stringify(bundle) + '\n')
  console.log(id, Object.keys(bundle).join(', '))
}
