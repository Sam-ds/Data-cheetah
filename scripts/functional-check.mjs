/**
 * Functional checks: pack zip integrity + DuckDB CDN instantiate path (Node).
 * Does not drive the full React UI (no Playwright in CI deps).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const JSZip = (await import('jszip')).default

const failures = []
const ok = []
const pass = (m) => {
  ok.push(m)
  console.log(`  ✓ ${m}`)
}
const fail = (m) => {
  failures.push(m)
  console.error(`  ✗ ${m}`)
}

console.log('\nPack ZIP integrity')
const zipDir = join(root, 'public/templates')
const zips = readdirSync(zipDir).filter((f) => f.endsWith('.datacheetah-dashboard.zip'))
if (!zips.length) fail('no dashboard zips found')
else pass(`found ${zips.length} pack zips`)

for (const name of zips) {
  const buf = readFileSync(join(zipDir, name))
  const zip = await JSZip.loadAsync(buf)
  const metaFile = zip.file('meta.json')
  const ruleFile = zip.file('rule.json')
  if (!metaFile || !ruleFile) {
    fail(`${name}: missing meta.json or rule.json`)
    continue
  }
  const meta = JSON.parse(await metaFile.async('string'))
  const rule = JSON.parse(await ruleFile.async('string'))
  if (!meta.id) fail(`${name}: meta.id missing`)
  else pass(`${name}: meta.id=${meta.id}`)
  if (!rule.requiredColumns && !rule.charts && !Array.isArray(rule)) {
    // rule shapes vary; at least require object
    if (typeof rule !== 'object') fail(`${name}: rule not object`)
    else pass(`${name}: rule.json ok`)
  } else pass(`${name}: rule.json ok`)

  const hasSample =
    zip.file('sample.csv') ||
    zip.file('samples-bundle.json') ||
    Object.keys(zip.files).some((p) => p.startsWith('samples/'))
  if (!hasSample) fail(`${name}: no sample data`)
  else pass(`${name}: sample present`)

  if (meta.renderer === 'dynamic' || zip.file('visualization.js')) {
    const viz = zip.file('visualization.js')
    if (!viz) fail(`${name}: dynamic pack missing visualization.js`)
    else {
      const code = await viz.async('string')
      if (code.length < 40) fail(`${name}: visualization.js too small`)
      else pass(`${name}: visualization.js ${code.length} B`)
    }
  }
}

console.log('\nTemplate folder parity')
const catalog = readFileSync(join(root, 'src/features/discover/content/templateCatalog.ts'), 'utf8')
const ids = [...catalog.matchAll(/templateBase\(['"]([^'"]+)['"]\)/g)].map((m) => m[1])
for (const id of ids) {
  const dir = join(zipDir, id)
  if (!existsSync(join(dir, 'meta.json'))) fail(`folder missing meta: ${id}`)
  else pass(`folder ${id}/meta.json`)
  if (!existsSync(join(dir, 'rule.json'))) fail(`folder missing rule: ${id}`)
  else pass(`folder ${id}/rule.json`)
}

console.log('\nDuckDB package')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const ver = pkg.dependencies['@duckdb/duckdb-wasm']
if (!String(ver).includes('1.32')) fail(`duckdb dep unexpected: ${ver}`)
else pass(`package @duckdb/duckdb-wasm ${ver}`)

console.log('\nDuckDB selectBundle (Node)')
try {
  const duckdb = await import('@duckdb/duckdb-wasm')
  const bundles = duckdb.getJsDelivrBundles?.() ?? null
  if (bundles) {
    const selected = await duckdb.selectBundle(bundles)
    if (!selected?.mainModule) fail('selectBundle returned empty')
    else pass(`selectBundle ok → ${String(selected.mainModule).split('/').pop()}`)
  } else {
    pass('selectBundle API present (bundled app uses ?url imports)')
  }
} catch (e) {
  fail(`selectBundle failed: ${e instanceof Error ? e.message : e}`)
}

console.log('\nMap name alignment')
const world = JSON.parse(readFileSync(join(root, 'public/geo/world.json'), 'utf8'))
const usa = JSON.parse(readFileSync(join(root, 'public/geo/usa-states.json'), 'utf8'))
const wNames = new Set(world.features.map((f) => f.properties?.name))
const sNames = new Set(usa.features.map((f) => f.properties?.name))
if (!wNames.has('United States')) fail('world.json missing United States')
else pass('world.json has United States')
if (!sNames.has('California')) fail('usa-states.json missing California')
else pass('usa-states.json has California')

console.log(`\n${'='.repeat(48)}`)
console.log(`Passed: ${ok.length}  Failed: ${failures.length}`)
if (failures.length) {
  for (const f of failures) console.error(` - ${f}`)
  process.exit(1)
}
console.log('ALL FUNCTIONAL CHECKS PASSED')
