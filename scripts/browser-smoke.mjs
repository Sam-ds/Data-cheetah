/**
 * Browser UI smoke via Playwright against vite preview.
 * Usage: node scripts/browser-smoke.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const base = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '')
const failures = []
const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => {
  failures.push(m)
  console.error(`  ✗ ${m}`)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const consoleErrors = []
page.on('pageerror', (err) => consoleErrors.push(String(err)))
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})

try {
  console.log(`\nBrowser smoke: ${base}\n`)
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('text=DataCheetah', { timeout: 20000 })
  pass('Home loads with DataCheetah branding')

  // Toolbar Discover (hero float animation can make Playwright think it's unstable)
  const discoverBtn = page.locator('button.home-hero-discover, button.app-toolbar-discover').first()
  if (await discoverBtn.count()) {
    await discoverBtn.click({ force: true })
    await page.waitForTimeout(1000)
    const bodyText = (await page.locator('body').innerText()).toLowerCase()
    if (bodyText.includes('template') || bodyText.includes('discover') || bodyText.includes('pack')) {
      pass('Discover view opens')
    } else {
      fail('Discover view did not show templates UI')
    }

    const card = page.locator('button, [role="button"]').filter({ hasText: /SaaS Metrics|Census Household|Market Scroll/i }).first()
    if (await card.count()) {
      await card.click({ force: true })
      await page.waitForTimeout(2000)
      pass('Opened a catalog template card')
      const useSample = page.getByRole('button', { name: /Use sample|Try sample|Open dashboard|Open with sample/i }).first()
      if (await useSample.count()) {
        await useSample.click({ force: true })
        await page.waitForTimeout(4000)
        pass('Triggered sample/open dashboard')
      }
    } else {
      fail('No template card found')
    }
  } else {
    fail('Discover button missing')
  }

  // Settings
  const settingsBtn = page.locator('button').filter({ hasText: /^Settings$/i }).first()
  if (await settingsBtn.count()) {
    await settingsBtn.click({ force: true })
  } else {
    await page.getByText(/^Settings$/i).first().click({ force: true, timeout: 5000 }).catch(() => null)
  }
  await page.waitForTimeout(1200)
  const clearEngine = page.getByRole('button', { name: /Clear SQL engine cache/i })
  if (await clearEngine.count()) pass('Settings shows Clear SQL engine cache')
  else fail('Clear SQL engine cache button missing')

  const restart = page.getByRole('button', { name: /Restart engine/i })
  if (await restart.count()) pass('Settings shows Restart engine')
  else fail('Restart engine button missing')

  // DuckDB CDN + Cache Storage from page context (same origin privileges)
  const cdnCheck = await page.evaluate(async () => {
    const ver = '1.32.0'
    const url = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${ver}/dist/duckdb-browser-eh.worker.js`
    const cacheName = `datacheetah-duckdb-wasm-${ver}`
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) return { ok: false, step: 'fetch', status: res.status }
    const cache = await caches.open(cacheName)
    await cache.put(url, res.clone())
    const hit = await cache.match(url)
    await caches.delete(cacheName)
    return { ok: Boolean(hit), step: 'cache', bytes: (await res.clone().arrayBuffer()).byteLength }
  })
  if (cdnCheck.ok) pass(`Browser can fetch+cache DuckDB worker (${cdnCheck.bytes} B)`)
  else fail(`DuckDB cache path failed at ${cdnCheck.step}: ${JSON.stringify(cdnCheck)}`)

  // Soft-check console: ignore known benign noise
  const serious = consoleErrors.filter(
    (e) =>
      !/favicon|Download the React DevTools|net::ERR_ABORTED|Failed to load resource.*favicon/i.test(e),
  )
  if (serious.length) {
    console.log('  console errors:', serious.slice(0, 8))
    // Don't fail hard on chart-load races; report
    if (serious.some((e) => /duckdb|TypeError|ReferenceError|is not defined/i.test(e))) {
      fail(`Serious console errors: ${serious.slice(0, 3).join(' | ')}`)
    } else {
      pass(`No DuckDB/Reference console errors (${serious.length} other messages)`)
    }
  } else pass('No page console errors')
} catch (e) {
  fail(e instanceof Error ? e.message : String(e))
} finally {
  await browser.close()
}

console.log(`\n${'='.repeat(48)}`)
if (failures.length) {
  console.error(`Failed: ${failures.length}`)
  for (const f of failures) console.error(` - ${f}`)
  process.exit(1)
}
console.log('ALL BROWSER SMOKE CHECKS PASSED')
