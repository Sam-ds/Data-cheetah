/**
 * Production smoke checks against vite preview + bundled templates.
 * Usage: node scripts/smoke-check.mjs [baseUrl]
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '')

const failures = []
const ok = []

function pass(msg) {
  ok.push(msg)
  console.log(`  ✓ ${msg}`)
}
function fail(msg) {
  failures.push(msg)
  console.error(`  ✗ ${msg}`)
}

async function expectStatus(url, want = 200, label = url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (res.status !== want) fail(`${label} → HTTP ${res.status}`)
  else pass(`${label} → ${res.status}`)
  return res
}

async function expectJson(url, label) {
  const res = await expectStatus(url, 200, label)
  try {
    const data = await res.json()
    pass(`${label} JSON ok`)
    return data
  } catch (e) {
    fail(`${label} not JSON: ${e.message}`)
    return null
  }
}

console.log(`\nSmoke base: ${base}\n`)

console.log('Dist')
const dist = join(root, 'dist')
if (!existsSync(dist)) fail('dist/ missing')
else {
  const walk = (dir, acc = []) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p, acc)
      else acc.push(p)
    }
    return acc
  }
  const files = walk(dist)
  const wasm = files.filter((f) => f.endsWith('.wasm'))
  if (wasm.length < 1) fail('expected bundled .wasm in dist')
  else pass(`bundled .wasm count=${wasm.length}`)

  const worker = files.find((f) => /duckdb\.worker-.*\.js$/.test(f))
  if (!worker) fail('duckdb.worker missing')
  else {
    const w = readFileSync(worker, 'utf8')
    if (w.includes('cdn.jsdelivr.net')) fail('worker still references jsDelivr CDN')
    else pass('worker uses bundled assets (no jsDelivr)')
  }

  const ehWorker = files.find((f) => /duckdb-browser-eh\.worker-.*\.js$/.test(f))
  if (!ehWorker) fail('duckdb-browser-eh.worker missing from dist')
  else pass('duckdb-browser-eh.worker bundled')
}

console.log('\nPreview HTTP')
await expectStatus(`${base}/`, 200, 'index.html')
await expectStatus(`${base}/sw.js`, 200, 'service worker')

console.log('\nTemplates')
const catalogSrc = readFileSync(join(root, 'src/features/discover/content/templateCatalog.ts'), 'utf8')
const templateIds = [...catalogSrc.matchAll(/templateBase\(['"]([^'"]+)['"]\)/g)].map((m) => m[1])
pass(`catalog templates: ${templateIds.length}`)
for (const id of templateIds.slice(0, 3)) {
  await expectJson(`${base}/templates/${id}/meta.json`, `/templates/${id}/meta.json`)
  await expectStatus(`${base}/templates/${id}/rule.json`, 200, `/templates/${id}/rule.json`)
}

console.log('\nGeo')
for (const g of ['/geo/usa-states.json', '/geo/world.json']) {
  await expectJson(`${base}${g}`, g)
}

console.log(`\n${'='.repeat(48)}`)
console.log(`Passed: ${ok.length}  Failed: ${failures.length}`)
if (failures.length) {
  for (const f of failures) console.error(` - ${f}`)
  process.exit(1)
}
console.log('ALL SMOKE CHECKS PASSED')
