/*
 * DataCheetah Three.js pack — Market Scroll Voyage
 *
 * A very tall scrollable story: eight cinematic chapters + interstitial
 * data panels. Scroll inside the sandboxed frame (or use Full screen).
 */
window.DataCheetahVisualization = {
  mount({ THREE, payload, root, reportHeight }) {
    const timeKey = String(payload.settings?.time || 'year')
    const regionKey = String(payload.settings?.region || 'region')
    const categoryKey = String(payload.settings?.category || 'category')
    const channelKey = String(payload.settings?.channel || 'channel')
    const measureKey = String(payload.settings?.measure || 'revenue')
    const ordersKey = String(payload.settings?.orders || 'orders')
    const customersKey = String(payload.settings?.customers || 'customers')
    const marginKey = String(payload.settings?.margin || 'margin')

    const number = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    const text = (v) => (v == null || v === '' ? '—' : String(v))
    const format = (v) =>
      new Intl.NumberFormat(undefined, {
        notation: Math.abs(v) >= 10000 ? 'compact' : 'standard',
        maximumFractionDigits: 1,
      }).format(v)

    const byYear = new Map()
    const regionSet = new Set()
    const categorySet = new Set()
    const channelSet = new Set()

    for (const row of payload.rows) {
      const year = String(row[timeKey] ?? '')
      const region = text(row[regionKey])
      const category = text(row[categoryKey])
      const channel = text(row[channelKey])
      if (!year || region === '—') continue
      regionSet.add(region)
      if (category !== '—') categorySet.add(category)
      if (channel !== '—') channelSet.add(channel)
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year).push({
        region,
        category,
        channel,
        revenue: number(row[measureKey]),
        orders: number(row[ordersKey]),
        customers: number(row[customersKey]),
        margin: number(row[marginKey]),
      })
    }

    const years = [...byYear.keys()].sort((a, b) => Number(a) - Number(b))
    const regions = [...regionSet].slice(0, 10)
    const categories = [...categorySet].slice(0, 8)
    const channels = [...channelSet].slice(0, 6)
    if (!years.length || !regions.length) {
      root.textContent = 'Need year + region (+ measures) rows for the scroll voyage'
      reportHeight(520)
      return () => {}
    }

    const latest = years[years.length - 1]
    const earliest = years[0]
    const rowsAt = (year) => byYear.get(year) || []
    const sum = (rows, key) => rows.reduce((a, r) => a + r[key], 0)
    const groupSum = (rows, key, dim) => {
      const m = new Map()
      for (const r of rows) m.set(r[dim], (m.get(r[dim]) || 0) + r[key])
      return m
    }

    const dark = payload.theme === 'dark'
    const accent = 0xf2a01f
    const cleanups = []
    const frames = []
    const VIEWPORT = 1040

    const styles = document.createElement('style')
    styles.textContent = `
      .msv { max-width: 1120px; margin: 0 auto; color: var(--text); padding-bottom: 48px; }
      .msv-hero {
        position: sticky; top: 0; z-index: 8;
        display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px;
        padding: 14px 16px; border: 1px solid var(--border); border-radius: 16px;
        background: color-mix(in srgb, var(--card) 92%, transparent);
        backdrop-filter: blur(12px); margin-bottom: 16px;
      }
      .msv-hero small { color: var(--accent); font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      .msv-hero h1 { margin: 4px 0 2px; font-size: 22px; }
      .msv-hero p { margin: 0; color: var(--muted); font-size: 12px; max-width: 36rem; }
      .msv-kpis { display: grid; grid-template-columns: repeat(4, minmax(4.5rem, 1fr)); gap: 8px; }
      .msv-kpi { padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); }
      .msv-kpi span { display: block; font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
      .msv-kpi strong { display: block; margin-top: 2px; font-size: 14px; font-variant-numeric: tabular-nums; }
      .msv-nav {
        position: sticky; top: 88px; z-index: 7;
        display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px;
        padding: 8px; border-radius: 14px; border: 1px solid var(--border);
        background: color-mix(in srgb, var(--card) 88%, transparent); backdrop-filter: blur(10px);
      }
      .msv-nav a {
        text-decoration: none; color: var(--muted); font-size: 11px; font-weight: 700;
        padding: 6px 10px; border-radius: 999px; border: 1px solid transparent;
      }
      .msv-nav a:hover, .msv-nav a.is-active {
        color: var(--text); border-color: var(--accent); background: var(--bg);
      }
      .msv-chapter {
        margin: 0 0 36px; border: 1px solid var(--border); border-radius: 18px; overflow: hidden;
        background: var(--card); scroll-margin-top: 150px;
      }
      .msv-chapter-head { padding: 18px 20px 10px; }
      .msv-chapter-head em {
        display: inline-block; margin-bottom: 6px; color: var(--accent);
        font-style: normal; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
      }
      .msv-chapter-head h2 { margin: 0 0 4px; font-size: 20px; }
      .msv-chapter-head p { margin: 0; color: var(--muted); font-size: 13px; max-width: 42rem; }
      .msv-chapter-head code, .msv-panel code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 11px; color: var(--text);
        background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px;
      }
      .msv-legend-list li strong { margin-left: 2px; font-variant-numeric: tabular-nums; }
      .msv-stage { position: relative; width: 100%; height: clamp(420px, 72vh, 820px); overflow: hidden; }
      .msv-hud { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 2; }
      .msv-tag {
        position: absolute; left: 0; top: 0;
        display: flex; flex-direction: column; gap: 0;
        max-width: 9rem; padding: 3px 7px;
        border: 1px solid color-mix(in srgb, var(--chip, #888) 45%, var(--border));
        border-radius: 8px;
        background: color-mix(in srgb, var(--card) 92%, transparent);
        box-shadow: 0 4px 14px rgba(0,0,0,.16);
        color: var(--text); font-size: 10px; font-weight: 750;
        white-space: nowrap; backdrop-filter: blur(6px);
        will-change: transform;
      }
      .msv-tag em {
        color: var(--muted); font-style: normal; font-weight: 650;
        font-size: 9px; font-variant-numeric: tabular-nums;
      }
      .msv-tag.is-core { border-color: var(--accent); }
      .msv-yearbar {
        position: sticky; top: 148px; z-index: 6;
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
        margin: 0 0 20px; padding: 10px 12px;
        border-radius: 14px; border: 1px solid var(--border);
        background: color-mix(in srgb, var(--card) 92%, transparent);
        backdrop-filter: blur(10px);
      }
      .msv-yearbar button {
        height: 32px; min-width: 36px; padding: 0 10px; border-radius: 8px;
        border: 1px solid var(--border); background: var(--bg); color: var(--text);
        font-weight: 800; cursor: pointer;
      }
      .msv-yearbar button:disabled { opacity: .4; cursor: default; }
      .msv-yearbar input[type="range"] { flex: 1; min-width: 140px; accent-color: var(--accent); }
      .msv-year-current {
        min-width: 4rem; font-size: 18px; font-weight: 800;
        font-variant-numeric: tabular-nums; color: var(--accent);
      }
      .msv-year-hint { font-size: 11px; color: var(--muted); max-width: 22rem; }
      .msv-year-badge {
        position: absolute; top: 10px; left: 10px; z-index: 3;
        padding: 5px 10px; border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--card) 92%, transparent);
        font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums;
        backdrop-filter: blur(6px); pointer-events: none; color: var(--text);
      }
      .msv-year-badge i {
        font-style: normal; color: var(--muted); font-weight: 700;
        font-size: 9px; letter-spacing: .08em; text-transform: uppercase; margin-right: 6px;
      }
      .msv-legend {
        margin: 0; padding: 12px 16px 16px; border-top: 1px solid var(--border);
        background: color-mix(in srgb, var(--bg) 72%, var(--card));
        font-size: 12px; color: var(--muted); line-height: 1.45;
      }
      .msv-legend-title {
        display: block; margin-bottom: 6px; font-size: 10px; font-weight: 800;
        letter-spacing: .08em; text-transform: uppercase; color: var(--accent);
      }
      .msv-legend-list {
        display: flex; flex-wrap: wrap; gap: 6px 10px; margin: 0; padding: 0; list-style: none;
      }
      .msv-legend-list li {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--card);
        font-variant-numeric: tabular-nums; color: var(--text);
      }
      .msv-swatch {
        width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
        box-shadow: inset 0 0 0 1px rgb(0 0 0 / 18%);
      }
      .msv-formula { margin-top: 8px; font-size: 11px; color: var(--muted); }
      .msv-formula code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 10px; color: var(--text);
        background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px;
      }
      .msv-panel {
        margin: 0 0 36px; padding: 22px 20px; border-radius: 18px;
        border: 1px dashed color-mix(in srgb, var(--accent) 45%, var(--border));
        background: color-mix(in srgb, var(--card) 70%, var(--bg));
        scroll-margin-top: 150px;
      }
      .msv-panel h3 { margin: 0 0 8px; font-size: 16px; }
      .msv-panel p { margin: 0 0 14px; color: var(--muted); font-size: 13px; max-width: 46rem; }
      .msv-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;
      }
      .msv-card {
        padding: 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg);
      }
      .msv-card span { display: block; font-size: 10px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
      .msv-card strong { display: block; margin-top: 4px; font-size: 15px; font-variant-numeric: tabular-nums; }
      .msv-card em { display: block; margin-top: 4px; font-style: normal; font-size: 11px; color: var(--muted); }
      .msv-bars { display: grid; gap: 8px; margin-top: 4px; }
      .msv-bar-row { display: grid; grid-template-columns: 7rem 1fr 3.5rem; gap: 8px; align-items: center; font-size: 11px; }
      .msv-bar-track { height: 8px; border-radius: 999px; background: var(--border); overflow: hidden; }
      .msv-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), var(--accent2)); }
      .msv-foot {
        padding: 28px 18px; border: 1px dashed var(--border); border-radius: 16px; text-align: center;
        color: var(--muted); font-size: 12px; margin-bottom: 8px;
      }
      .msv-progress {
        position: fixed; left: 0; right: 0; top: 0; height: 3px; z-index: 20;
        background: transparent; pointer-events: none;
      }
      .msv-progress > i {
        display: block; height: 100%; width: 0%;
        background: linear-gradient(90deg, var(--accent), var(--accent2));
      }
      @media (max-width: 720px) {
        .msv-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .msv-stage { height: clamp(340px, 58vh, 560px); }
        .msv-nav { top: 120px; }
        .msv-yearbar { top: 170px; }
        .msv-bar-row { grid-template-columns: 5rem 1fr 3rem; }
      }
    `
    document.head.appendChild(styles)
    cleanups.push(() => styles.remove())

    const metricsFor = (year) => {
      const rows = rowsAt(year)
      const totalRev = sum(rows, 'revenue')
      const totalOrd = sum(rows, 'orders')
      const totalCus = sum(rows, 'customers')
      const avgMargin = rows.reduce((a, r) => a + r.margin * r.revenue, 0) / Math.max(1, totalRev)
      const regionRev = groupSum(rows, 'revenue', 'region')
      const catRev = groupSum(rows, 'revenue', 'category')
      const channelOrd = groupSum(rows, 'orders', 'channel')
      const maxRegion = Math.max(1, ...regions.map((r) => regionRev.get(r) || 0))
      const maxCat = Math.max(1, ...categories.map((c) => catRev.get(c) || 0))
      return { year, rows, totalRev, totalOrd, totalCus, avgMargin, regionRev, catRev, channelOrd, maxRegion, maxCat }
    }

    const firstRev = sum(rowsAt(earliest), 'revenue')
    const yearListeners = []
    let yearIndex = years.length - 1
    let snap = metricsFor(years[yearIndex])

    // One shared hex palette for legends, floating tags, and meshes (keyed by value, not sort rank)
    const hexFromHsl = (h, s, l) => `#${new THREE.Color().setHSL(h, s, l).getHexString()}`
    const accentHex = `#${new THREE.Color(accent).getHexString()}`
    const colorOf = {
      region: (name) => {
        const i = Math.max(0, regions.indexOf(name))
        return hexFromHsl(0.05 + (i % 10) * 0.08, 0.65, 0.52)
      },
      category: (name) => {
        const i = Math.max(0, categories.indexOf(name))
        return hexFromHsl(0.55 + (i % 8) * 0.07, 0.72, 0.55)
      },
      channel: (name) => {
        const i = Math.max(0, channels.indexOf(name))
        return hexFromHsl(0.48 + (i % 6) * 0.08, 0.7, 0.55)
      },
      year: (name) => {
        const i = Math.max(0, years.indexOf(String(name)))
        return hexFromHsl(0.08 + (i % Math.max(1, years.length)) * 0.06, 0.75, 0.55)
      },
      accent: accentHex,
      orders: '#38bdf8',
    }
    const threeOf = (hex) => new THREE.Color(hex)

    const legendBlock = (title, formula, items) => `
      <aside class="msv-legend">
        <span class="msv-legend-title">${title}</span>
        <ul class="msv-legend-list"></ul>
        <p class="msv-formula">${formula}</p>
      </aside>`

    const fillLegend = (aside, items) => {
      const ul = aside.querySelector('.msv-legend-list')
      if (!ul) return
      ul.innerHTML = items
        .map(
          (it) =>
            `<li>${it.color ? `<i class="msv-swatch" style="background:${it.color}"></i>` : ''}<span>${it.label}</span>${
              it.value != null ? `<strong>${it.value}</strong>` : ''
            }</li>`,
        )
        .join('')
    }

    const regionCardsHtml = (m) =>
      regions
        .map((r) => {
          const v = m.regionRev.get(r) || 0
          const chip = colorOf.region(r)
          return `<div class="msv-card"><span><i class="msv-swatch" style="background:${chip};display:inline-block;margin-right:6px;vertical-align:middle"></i>${r}</span><strong>${format(v)}</strong><em>${((v / m.maxRegion) * 100).toFixed(0)}% of top region · ${m.year}</em></div>`
        })
        .join('')

    const catBarsHtml = (m) =>
      [...categories]
        .sort((a, b) => (m.catRev.get(b) || 0) - (m.catRev.get(a) || 0))
        .map((c) => {
          const v = m.catRev.get(c) || 0
          const pct = (v / m.maxCat) * 100
          const chip = colorOf.category(c)
          return `<div class="msv-bar-row"><span><i class="msv-swatch" style="background:${chip};display:inline-block;margin-right:6px;vertical-align:middle"></i>${c}</span><div class="msv-bar-track"><div class="msv-bar-fill" style="width:${pct}%;background:${chip}"></div></div><strong>${format(v)}</strong></div>`
        })
        .join('')

    const yearCards = years
      .map((y) => {
        const v = sum(rowsAt(y), 'revenue')
        const chip = colorOf.year(y)
        return `<div class="msv-card"><span><i class="msv-swatch" style="background:${chip};display:inline-block;margin-right:6px;vertical-align:middle"></i>${timeKey} ${y}</span><strong>${format(v)}</strong><em>${format(sum(rowsAt(y), 'orders'))} ${ordersKey}</em></div>`
      })
      .join('')

    const board = document.createElement('div')
    board.className = 'msv'
    board.innerHTML = `
      <div class="msv-progress" aria-hidden="true"><i></i></div>
      <header class="msv-hero">
        <div>
          <small>Long-form scroll voyage</small>
          <h1></h1>
          <p>Scrub <code>${timeKey}</code> below — orbit, skyline, stars, river, lattice, and finale redraw for that year. Corridor & helix keep the full timeline.</p>
        </div>
        <div class="msv-kpis">
          <div class="msv-kpi"><span>${measureKey} · <b class="msv-live-year">${snap.year}</b></span><strong class="msv-kpi-rev">${format(snap.totalRev)}</strong></div>
          <div class="msv-kpi"><span>${ordersKey}</span><strong class="msv-kpi-ord">${format(snap.totalOrd)}</strong></div>
          <div class="msv-kpi"><span>${customersKey}</span><strong class="msv-kpi-cus">${format(snap.totalCus)}</strong></div>
          <div class="msv-kpi"><span>Growth ${earliest}→<b class="msv-live-year">${snap.year}</b></span><strong class="msv-kpi-growth"></strong></div>
        </div>
      </header>
      <nav class="msv-nav" aria-label="Chapters">
        <a href="#msv-orbit">01 Orbit</a>
        <a href="#msv-skyline">02 Skyline</a>
        <a href="#msv-brief-regions">Regions</a>
        <a href="#msv-constellation">03 Stars</a>
        <a href="#msv-river">04 River</a>
        <a href="#msv-brief-mix">Mix</a>
        <a href="#msv-corridor">05 Corridor</a>
        <a href="#msv-lattice">06 Lattice</a>
        <a href="#msv-helix">07 Helix</a>
        <a href="#msv-brief-years">Years</a>
        <a href="#msv-finale">08 Finale</a>
      </nav>

      <div class="msv-yearbar" role="group" aria-label="${timeKey} scrubber">
        <button type="button" class="msv-year-prev" aria-label="Previous ${timeKey}">‹</button>
        <strong class="msv-year-current">${snap.year}</strong>
        <input class="msv-year-scrub" type="range" min="0" max="${Math.max(0, years.length - 1)}" step="1" value="${yearIndex}" />
        <button type="button" class="msv-year-next" aria-label="Next ${timeKey}">›</button>
        <span class="msv-year-hint">Selected ${timeKey} drives snapshot chapters. Corridor / helix show every ${timeKey}.</span>
      </div>

      <section class="msv-chapter" id="msv-orbit">
        <div class="msv-chapter-head">
          <em>Chapter 01</em>
          <h2>Global orbit</h2>
          <p>Core + moons for selected <code>${timeKey}</code> <b class="msv-live-year">${snap.year}</b>. Moon size ∝ that region’s <code>${measureKey}</code>.</p>
        </div>
        <div class="msv-stage" data-scene="orbit"></div>
        ${legendBlock('How to read · Orbit', `Core / moons use selected <code>${timeKey}</code> (scrubber).`, [])}
      </section>

      <section class="msv-chapter" id="msv-skyline">
        <div class="msv-chapter-head">
          <em>Chapter 02</em>
          <h2>Region skyline</h2>
          <p>One tower per <code>${regionKey}</code> for <b class="msv-live-year">${snap.year}</b>. Height ∝ <code>${measureKey}</code>. Drag to orbit.</p>
        </div>
        <div class="msv-stage" data-scene="skyline"></div>
        ${legendBlock('How to read · Skyline', `Tower height ∝ <code>${measureKey}</code> by <code>${regionKey}</code> for selected <code>${timeKey}</code>.`, [])}
      </section>

      <section class="msv-panel" id="msv-brief-regions">
        <h3>${regionKey} brief · <b class="msv-live-year">${snap.year}</b></h3>
        <p>Same numbers as the skyline for the selected ${timeKey}.</p>
        <div class="msv-grid msv-region-grid">${regionCardsHtml(snap)}</div>
      </section>

      <section class="msv-chapter" id="msv-constellation">
        <div class="msv-chapter-head">
          <em>Chapter 03</em>
          <h2>Category constellation</h2>
          <p>One star per <code>${categoryKey}</code> for <b class="msv-live-year">${snap.year}</b>. Size ∝ <code>${measureKey}</code>.</p>
        </div>
        <div class="msv-stage" data-scene="constellation"></div>
        ${legendBlock('How to read · Constellation', `Star size ∝ <code>${measureKey}</code> by <code>${categoryKey}</code> for selected <code>${timeKey}</code>.`, [])}
      </section>

      <section class="msv-chapter" id="msv-river">
        <div class="msv-chapter-head">
          <em>Chapter 04</em>
          <h2>Channel river</h2>
          <p>Lanes by <code>${channelKey}</code> for <b class="msv-live-year">${snap.year}</b>. Speed / lift ∝ <code>${ordersKey}</code> share.</p>
        </div>
        <div class="msv-stage" data-scene="river"></div>
        ${legendBlock('How to read · River', `Each lane = one <code>${channelKey}</code> in selected <code>${timeKey}</code>.`, [])}
      </section>

      <section class="msv-panel" id="msv-brief-mix">
        <h3>${categoryKey} mix · <b class="msv-live-year">${snap.year}</b></h3>
        <p>Same <code>${measureKey}</code> shares as the constellation for the selected ${timeKey}.</p>
        <div class="msv-bars msv-cat-bars">${catBarsHtml(snap)}</div>
        <p style="margin-top:16px;margin-bottom:8px">Avg <code>${marginKey}</code> (weighted): <strong class="msv-avg-margin" style="color:var(--text)">${format(snap.avgMargin)}%</strong></p>
      </section>

      <section class="msv-chapter" id="msv-corridor">
        <div class="msv-chapter-head">
          <em>Chapter 05</em>
          <h2>Timeline corridor</h2>
          <p>One gate per <code>${timeKey}</code> from ${earliest} → ${latest}. Highlighted gate = camera focus. Gate height ∝ that year’s <code>${measureKey}</code>.</p>
        </div>
        <div class="msv-stage" data-scene="corridor"></div>
        ${legendBlock(
          'How to read · Corridor',
          `Full timeline — not controlled by the scrubber. Each gate = one <code>${timeKey}</code>.`,
          years.map((y) => ({ label: String(y), value: format(sum(rowsAt(y), 'revenue')), color: '#f2a01f' })),
        )}
      </section>

      <section class="msv-chapter" id="msv-lattice">
        <div class="msv-chapter-head">
          <em>Chapter 06</em>
          <h2>Region × category lattice</h2>
          <p>Grid for <b class="msv-live-year">${snap.year}</b>. Columns = <code>${regionKey}</code>, rows = <code>${categoryKey}</code>.</p>
        </div>
        <div class="msv-stage" data-scene="lattice"></div>
        ${legendBlock('How to read · Lattice', `Cell height ∝ <code>${measureKey}</code> for selected <code>${timeKey}</code>.`, [])}
      </section>

      <section class="msv-chapter" id="msv-helix">
        <div class="msv-chapter-head">
          <em>Chapter 07</em>
          <h2>Growth helix</h2>
          <p>Each bead = one <code>${timeKey}</code>. Radius ∝ that year’s <code>${measureKey}</code>. Tags highlight the nearest bead.</p>
        </div>
        <div class="msv-stage" data-scene="helix"></div>
        ${legendBlock(
          'How to read · Helix',
          `Full timeline spiral — not controlled by the scrubber.`,
          years.map((y) => ({ label: String(y), value: format(sum(rowsAt(y), 'revenue')), color: '#38bdf8' })),
        )}
      </section>

      <section class="msv-panel" id="msv-brief-years">
        <h3>Every ${timeKey}</h3>
        <p>Full ledger — compare years side by side (same totals as corridor / helix).</p>
        <div class="msv-grid">${yearCards}</div>
      </section>

      <section class="msv-chapter" id="msv-finale">
        <div class="msv-chapter-head">
          <em>Chapter 08</em>
          <h2>Market finale</h2>
          <p>Core / sparks for selected <code>${timeKey}</code> <b class="msv-live-year">${snap.year}</b>.</p>
        </div>
        <div class="msv-stage" data-scene="finale"></div>
        ${legendBlock('How to read · Finale', `Scales with selected <code>${timeKey}</code> totals.`, [])}
      </section>

      <div class="msv-foot">
        End of voyage · ${payload.rows.length} mapped rows · ${years.length} ${timeKey}s (${earliest}–${latest}) · ${regions.length} regions · ${categories.length} categories · ${channels.length} channels
      </div>
    `
    board.querySelector('h1').textContent = payload.title || 'Market scroll voyage'
    root.appendChild(board)
    cleanups.push(() => board.remove())

    const scrub = board.querySelector('.msv-year-scrub')
    const yearCurrent = board.querySelector('.msv-year-current')
    const prevBtn = board.querySelector('.msv-year-prev')
    const nextBtn = board.querySelector('.msv-year-next')
    const kpiRev = board.querySelector('.msv-kpi-rev')
    const kpiOrd = board.querySelector('.msv-kpi-ord')
    const kpiCus = board.querySelector('.msv-kpi-cus')
    const kpiGrowth = board.querySelector('.msv-kpi-growth')
    const regionGrid = board.querySelector('.msv-region-grid')
    const catBarsEl = board.querySelector('.msv-cat-bars')
    const avgMarginEl = board.querySelector('.msv-avg-margin')

    const orbitLegendEl = board.querySelector('#msv-orbit .msv-legend')
    const skylineLegendEl = board.querySelector('#msv-skyline .msv-legend')
    const constellationLegendEl = board.querySelector('#msv-constellation .msv-legend')
    const riverLegendEl = board.querySelector('#msv-river .msv-legend')
    const latticeLegendEl = board.querySelector('#msv-lattice .msv-legend')
    const finaleLegendEl = board.querySelector('#msv-finale .msv-legend')
    fillLegend(
      board.querySelector('#msv-corridor .msv-legend'),
      years.map((y) => ({ label: String(y), value: format(sum(rowsAt(y), 'revenue')), color: colorOf.year(y) })),
    )
    fillLegend(
      board.querySelector('#msv-helix .msv-legend'),
      years.map((y) => ({ label: String(y), value: format(sum(rowsAt(y), 'revenue')), color: colorOf.year(y) })),
    )

    const regListSafe = () => regions.slice(0, 6)
    const catListSafe = () => categories.slice(0, 6)

    const refreshSnapshotLegends = (m) => {
      fillLegend(orbitLegendEl, [
        { label: `Core · ${m.year} ${measureKey}`, value: format(m.totalRev), color: colorOf.accent },
        ...regions.slice(0, 6).map((r) => ({
          label: r,
          value: format(m.regionRev.get(r) || 0),
          color: colorOf.region(r),
        })),
      ])
      fillLegend(
        skylineLegendEl,
        regions.map((r) => ({
          label: r,
          value: format(m.regionRev.get(r) || 0),
          color: colorOf.region(r),
        })),
      )
      fillLegend(
        constellationLegendEl,
        [...categories]
          .sort((a, b) => (m.catRev.get(b) || 0) - (m.catRev.get(a) || 0))
          .map((c) => ({
            label: c,
            value: format(m.catRev.get(c) || 0),
            color: colorOf.category(c),
          })),
      )
      fillLegend(
        riverLegendEl,
        channels.map((c) => ({
          label: c,
          value: format(m.channelOrd.get(c) || 0),
          color: colorOf.channel(c),
        })),
      )
      fillLegend(latticeLegendEl, [
        ...regListSafe().map((r) => ({ label: `${regionKey}: ${r}`, color: colorOf.region(r) })),
        ...catListSafe().map((c) => ({ label: `${categoryKey}: ${c}`, color: colorOf.category(c) })),
        { label: `${timeKey}`, value: String(m.year), color: colorOf.year(m.year) },
      ])
      fillLegend(finaleLegendEl, [
        { label: `${measureKey} · ${m.year}`, value: format(m.totalRev), color: colorOf.accent },
        { label: ordersKey, value: format(m.totalOrd), color: colorOf.orders },
        { label: `${regionKey}s`, value: String(regions.length), color: colorOf.region(regions[0]) },
        { label: `${categoryKey}s`, value: String(categories.length), color: colorOf.category(categories[0]) },
      ])
    }

    const setYearIndex = (idx) => {
      yearIndex = Math.max(0, Math.min(years.length - 1, idx))
      snap = metricsFor(years[yearIndex])
      const g = firstRev > 0 ? ((snap.totalRev - firstRev) / firstRev) * 100 : 0
      yearCurrent.textContent = snap.year
      scrub.value = String(yearIndex)
      prevBtn.disabled = yearIndex <= 0
      nextBtn.disabled = yearIndex >= years.length - 1
      board.querySelectorAll('.msv-live-year').forEach((el) => {
        el.textContent = snap.year
      })
      kpiRev.textContent = format(snap.totalRev)
      kpiOrd.textContent = format(snap.totalOrd)
      kpiCus.textContent = format(snap.totalCus)
      kpiGrowth.textContent = `${g >= 0 ? '+' : ''}${format(g)}%`
      if (regionGrid) regionGrid.innerHTML = regionCardsHtml(snap)
      if (catBarsEl) catBarsEl.innerHTML = catBarsHtml(snap)
      if (avgMarginEl) avgMarginEl.textContent = `${format(snap.avgMargin)}%`
      refreshSnapshotLegends(snap)
      for (const fn of yearListeners) fn(snap)
    }

    scrub.addEventListener('input', () => setYearIndex(Number(scrub.value)))
    prevBtn.addEventListener('click', () => setYearIndex(yearIndex - 1))
    nextBtn.addEventListener('click', () => setYearIndex(yearIndex + 1))
    cleanups.push(() => {
      scrub.replaceWith(scrub.cloneNode(true))
    })

    const progressFill = board.querySelector('.msv-progress > i')
    const navLinks = [...board.querySelectorAll('.msv-nav a')]
    const chapterIds = navLinks.map((a) => a.getAttribute('href')?.slice(1)).filter(Boolean)

    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - document.documentElement.clientHeight)
      const pct = Math.min(100, (document.documentElement.scrollTop / max) * 100)
      if (progressFill) progressFill.style.width = `${pct}%`
      let active = chapterIds[0]
      for (const id of chapterIds) {
        const el = board.querySelector(`#${CSS.escape(id)}`)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 180) active = id
      }
      for (const a of navLinks) {
        a.classList.toggle('is-active', a.getAttribute('href') === `#${active}`)
      }
    }
    document.addEventListener('scroll', onScroll, { passive: true })
    cleanups.push(() => document.removeEventListener('scroll', onScroll))

    const makeRenderer = (stage, { badgeMode = 'snap' } = {}) => {
      stage.replaceChildren()
      const labelsLayer = document.createElement('div')
      labelsLayer.className = 'msv-hud'
      labelsLayer.setAttribute('aria-hidden', 'true')
      stage.appendChild(labelsLayer)

      const yearBadge = document.createElement('div')
      yearBadge.className = 'msv-year-badge'
      yearBadge.innerHTML = '<i></i><b></b>'
      stage.appendChild(yearBadge)
      const setBadge = (label, value) => {
        yearBadge.querySelector('i').textContent = label
        yearBadge.querySelector('b').textContent = value
      }
      if (badgeMode === 'snap') setBadge(`Showing ${timeKey}`, snap.year)
      else if (badgeMode === 'all') setBadge(`All ${timeKey}s`, `${earliest}–${latest}`)

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(dark ? 0x070d18 : 0xeef3f8)
      scene.fog = new THREE.Fog(scene.background.getHex(), 18, 48)
      const camera = new THREE.PerspectiveCamera(42, stage.clientWidth / Math.max(1, stage.clientHeight), 0.1, 140)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
      renderer.setSize(stage.clientWidth, stage.clientHeight)
      stage.insertBefore(renderer.domElement, labelsLayer)
      scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x0b1220 : 0x94a3b8, 1.35))
      const key = new THREE.DirectionalLight(0xffffff, 2.1)
      key.position.set(5, 12, 8)
      scene.add(key)
      const point = new THREE.PointLight(accent, 1.2, 50)
      point.position.set(-3, 5, -4)
      scene.add(point)

      const tmp = new THREE.Vector3()
      const makeTag = (title, value, colorHex) => {
        const el = document.createElement('div')
        el.className = 'msv-tag'
        if (colorHex) el.style.setProperty('--chip', colorHex)
        el.innerHTML = '<b></b><em></em>'
        el.querySelector('b').textContent = title
        el.querySelector('em').textContent = value == null ? '' : String(value)
        labelsLayer.appendChild(el)
        return el
      }
      const setTag = (el, title, value) => {
        el.querySelector('b').textContent = title
        el.querySelector('em').textContent = value == null ? '' : String(value)
      }
      const projectTag = (el, world, dy = -120) => {
        tmp.copy(world).project(camera)
        const x = (tmp.x * 0.5 + 0.5) * stage.clientWidth
        const y = (-tmp.y * 0.5 + 0.5) * stage.clientHeight
        const on =
          tmp.z > -1 &&
          tmp.z < 1 &&
          x > -48 &&
          x < stage.clientWidth + 48 &&
          y > -48 &&
          y < stage.clientHeight + 48
        el.style.display = on ? 'flex' : 'none'
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${dy}%)`
      }

      return { scene, camera, renderer, point, makeTag, setTag, projectTag, setBadge, yearBadge }
    }

    const bindResize = (stage, camera, renderer) => {
      const ro = new ResizeObserver(() => {
        const w = stage.clientWidth
        const h = stage.clientHeight
        if (!w || !h) return
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
        reportHeight(VIEWPORT)
      })
      ro.observe(stage)
      cleanups.push(() => ro.disconnect())
    }

    const anchor = new THREE.Vector3()

    // —— Orbit ——
    {
      const stage = board.querySelector('[data-scene="orbit"]')
      const { scene, camera, renderer, point, makeTag, setTag, projectTag, setBadge } = makeRenderer(stage)
      camera.position.set(0, 3.2, 9)
      camera.lookAt(0, 0.4, 0)
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.6, 1),
        new THREE.MeshStandardMaterial({
          color: accent,
          emissive: new THREE.Color(accent).multiplyScalar(0.35),
          roughness: 0.35,
          metalness: 0.45,
          flatShading: true,
        }),
      )
      scene.add(core)
      const coreTag = makeTag(`${measureKey}`, format(snap.totalRev), colorOf.accent)
      coreTag.classList.add('is-core')
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, 0.05, 10, 80),
        new THREE.MeshStandardMaterial({ color: dark ? 0x64748b : 0x94a3b8, emissive: new THREE.Color(accent).multiplyScalar(0.15) }),
      )
      ring.rotation.x = Math.PI / 2.4
      scene.add(ring)
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(3.4, 0.03, 8, 90),
        new THREE.MeshStandardMaterial({ color: dark ? 0x334155 : 0xcbd5e1 }),
      )
      ring2.rotation.x = Math.PI / 3
      scene.add(ring2)
      const moons = []
      const orbitRegions = regions.slice(0, 6)
      orbitRegions.forEach((region, i) => {
        const hex = colorOf.region(region)
        const color = threeOf(hex)
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 16, 16),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color.clone().multiplyScalar(0.35),
          }),
        )
        scene.add(moon)
        moons.push({
          mesh: moon,
          region,
          tag: makeTag(region, format(snap.regionRev.get(region) || 0), hex),
          angle: (i / Math.max(1, orbitRegions.length)) * Math.PI * 2,
          radius: 3.1 + (i % 3) * 0.25,
          speed: 0.25,
          weight: 0.5,
        })
      })
      let coreScale = 1
      const apply = (m) => {
        setBadge(`Showing ${timeKey}`, m.year)
        coreScale = 0.85 + Math.min(1.35, Math.log10(Math.max(10, m.totalRev)) / 6)
        core.scale.setScalar(coreScale)
        ring.scale.setScalar(coreScale)
        ring2.scale.setScalar(coreScale)
        setTag(coreTag, `${measureKey} · ${m.year}`, format(m.totalRev))
        for (const moon of moons) {
          moon.weight = (m.regionRev.get(moon.region) || 0) / m.maxRegion
          const r = 0.12 + moon.weight * 0.28
          moon.mesh.geometry.dispose()
          moon.mesh.geometry = new THREE.SphereGeometry(r, 16, 16)
          moon.radius = (3.1 + (moons.indexOf(moon) % 3) * 0.25) * coreScale
          moon.speed = 0.22 + moon.weight * 0.2
          setTag(moon.tag, moon.region, `${format(m.regionRev.get(moon.region) || 0)} · ${m.year}`)
        }
      }
      yearListeners.push(apply)
      apply(snap)
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        core.rotation.y = t * 0.35
        core.rotation.x = Math.sin(t * 0.4) * 0.15
        ring.rotation.z = t * 0.2
        ring2.rotation.z = -t * 0.12
        point.intensity = 1 + Math.sin(t * 2) * 0.25
        projectTag(coreTag, anchor.set(0, 1.8 * coreScale, 0), -100)
        for (const m of moons) {
          const a = m.angle + t * m.speed
          m.mesh.position.set(Math.cos(a) * m.radius, Math.sin(a * 1.4) * 0.45, Math.sin(a) * m.radius)
          projectTag(m.tag, anchor.copy(m.mesh.position).setY(m.mesh.position.y + 0.35))
        }
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    // —— Skyline ——
    {
      const stage = board.querySelector('[data-scene="skyline"]')
      const { scene, camera, renderer, makeTag, setTag, projectTag, setBadge } = makeRenderer(stage)
      camera.position.set(0, 8, 16)
      camera.lookAt(0, 2, 0)
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(12, 48),
        new THREE.MeshStandardMaterial({ color: dark ? 0x0f172a : 0xdbe4ef, roughness: 0.95 }),
      )
      ground.rotation.x = -Math.PI / 2
      scene.add(ground)
      const towers = []
      regions.forEach((region, i) => {
        const hex = colorOf.region(region)
        const color = threeOf(hex)
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 1, 0.9),
          new THREE.MeshStandardMaterial({
            color,
            emissive: new THREE.Color(accent).multiplyScalar(0.08),
            roughness: 0.4,
          }),
        )
        const x = (i - (regions.length - 1) / 2) * 1.35
        mesh.position.set(x, 0.5, 0)
        scene.add(mesh)
        towers.push({
          mesh,
          region,
          h: 1,
          tag: makeTag(region, format(snap.regionRev.get(region) || 0), hex),
        })
      })
      const apply = (m) => {
        setBadge(`Showing ${timeKey}`, m.year)
        for (const tower of towers) {
          tower.h = 0.4 + ((m.regionRev.get(tower.region) || 0) / m.maxRegion) * 6.5
          tower.mesh.scale.y = tower.h
          tower.mesh.position.y = tower.h / 2
          setTag(tower.tag, tower.region, `${format(m.regionRev.get(tower.region) || 0)} · ${m.year}`)
        }
      }
      yearListeners.push(apply)
      apply(snap)
      let drag = false
      let prevX = 0
      let rot = 0.2
      const onDown = (e) => {
        drag = true
        prevX = e.clientX
        renderer.domElement.setPointerCapture(e.pointerId)
      }
      const onMove = (e) => {
        if (!drag) return
        rot += (e.clientX - prevX) * 0.005
        prevX = e.clientX
      }
      const onUp = () => {
        drag = false
      }
      renderer.domElement.addEventListener('pointerdown', onDown)
      renderer.domElement.addEventListener('pointermove', onMove)
      renderer.domElement.addEventListener('pointerup', onUp)
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        const groupY = rot + Math.sin(t * 0.2) * 0.03
        for (const tower of towers) {
          tower.mesh.rotation.y = groupY
          tower.mesh.position.z = Math.sin(groupY + tower.mesh.position.x * 0.2) * 0.15
          projectTag(tower.tag, anchor.set(tower.mesh.position.x, tower.h + 0.35, tower.mesh.position.z))
        }
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.domElement.removeEventListener('pointerdown', onDown)
        renderer.domElement.removeEventListener('pointermove', onMove)
        renderer.domElement.removeEventListener('pointerup', onUp)
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    // —— Constellation ——
    {
      const stage = board.querySelector('[data-scene="constellation"]')
      const { scene, camera, renderer, makeTag, setTag, projectTag, setBadge } = makeRenderer(stage)
      camera.position.set(0, 0, 11)
      camera.lookAt(0, 0, 0)
      const stars = []
      categories.forEach((cat, i) => {
        const hex = colorOf.category(cat)
        const color = threeOf(hex)
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 20, 20),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color.clone().multiplyScalar(0.4),
            roughness: 0.3,
          }),
        )
        scene.add(mesh)
        stars.push({
          mesh,
          cat,
          weight: 0.5,
          tag: makeTag(cat, format(snap.catRev.get(cat) || 0), hex),
          angle: (i / Math.max(1, categories.length)) * Math.PI * 2,
          radius: 2.8,
          speed: 0.2,
          bob: i * 0.7,
        })
      })
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i]
        const b = stars[(i + 1) % stars.length]
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: dark ? 0x334155 : 0xcbd5e1 }))
        scene.add(line)
        a.link = line
        a.linkTo = b
      }
      const apply = (m) => {
        setBadge(`Showing ${timeKey}`, m.year)
        for (const s of stars) {
          s.weight = (m.catRev.get(s.cat) || 0) / m.maxCat
          s.mesh.geometry.dispose()
          s.mesh.geometry = new THREE.SphereGeometry(0.2 + s.weight * 0.55, 20, 20)
          s.radius = 2.2 + s.weight * 1.8
          s.speed = 0.15 + s.weight * 0.25
          setTag(s.tag, s.cat, `${format(m.catRev.get(s.cat) || 0)} · ${m.year}`)
        }
      }
      yearListeners.push(apply)
      apply(snap)
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        for (const s of stars) {
          const a = s.angle + t * s.speed
          s.mesh.position.set(Math.cos(a) * s.radius, Math.sin(t * 0.8 + s.bob) * 0.7, Math.sin(a) * s.radius)
          if (s.link && s.linkTo) {
            s.link.geometry.setFromPoints([s.mesh.position.clone(), s.linkTo.mesh.position.clone()])
          }
          projectTag(s.tag, anchor.copy(s.mesh.position).setY(s.mesh.position.y + 0.45))
        }
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    // —— River ——
    {
      const stage = board.querySelector('[data-scene="river"]')
      const { scene, camera, renderer, makeTag, setTag, projectTag, setBadge } = makeRenderer(stage)
      camera.position.set(0, 7, 14)
      camera.lookAt(0, 0, 0)
      const colors = channels.map((ch) => threeOf(colorOf.channel(ch)))
      const laneTags = channels.map((ch, i) => {
        const hex = colorOf.channel(ch)
        return {
          channel: ch,
          lane: (i - (channels.length - 1) / 2) * 1.1,
          tag: makeTag(ch, format(snap.channelOrd.get(ch) || 0), hex),
        }
      })
      let liveChannelOrd = snap.channelOrd
      const COUNT = 900
      const pos = new Float32Array(COUNT * 3)
      const col = new Float32Array(COUNT * 3)
      const meta = []
      for (let i = 0; i < COUNT; i++) {
        const ci = i % Math.max(1, channels.length)
        meta.push({
          channelIndex: ci,
          t: Math.random(),
          speed: 0.15 + Math.random() * 0.45,
          lane: (ci - (channels.length - 1) / 2) * 1.1,
          wobble: Math.random() * Math.PI * 2,
        })
        const c = colors[ci] || new THREE.Color(accent)
        col[i * 3] = c.r
        col[i * 3 + 1] = c.g
        col[i * 3 + 2] = c.b
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      const points = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }),
      )
      scene.add(points)
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(16, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: dark ? 0x111827 : 0xe2e8f0, roughness: 1 }),
      )
      bed.position.y = -0.2
      scene.add(bed)
      yearListeners.push((m) => {
        setBadge(`Showing ${timeKey}`, m.year)
        liveChannelOrd = m.channelOrd
        for (const lane of laneTags) {
          setTag(lane.tag, lane.channel, `${format(m.channelOrd.get(lane.channel) || 0)} · ${m.year}`)
        }
      })
      setBadge(`Showing ${timeKey}`, snap.year)
      bindResize(stage, camera, renderer)
      frames.push((t, dt) => {
        const orderSum = Math.max(1, [...liveChannelOrd.values()].reduce((a, b) => a + b, 0))
        for (let i = 0; i < COUNT; i++) {
          const m = meta[i]
          const share = (liveChannelOrd.get(channels[m.channelIndex]) || 1) / orderSum
          m.t = (m.t + (m.speed + share * 0.6) * dt) % 1
          const x = -7 + m.t * 14
          const z = m.lane + Math.sin(m.t * 8 + m.wobble) * 0.35
          const y = 0.2 + Math.sin(m.t * Math.PI) * (0.6 + share * 1.4)
          pos[i * 3] = x
          pos[i * 3 + 1] = y
          pos[i * 3 + 2] = z
        }
        geo.attributes.position.needsUpdate = true
        camera.position.x = Math.sin(t * 0.15) * 1.5
        for (const lane of laneTags) {
          projectTag(lane.tag, anchor.set(0, 1.6, lane.lane), -50)
        }
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    // —— Corridor (all years) ——
    {
      const stage = board.querySelector('[data-scene="corridor"]')
      const { scene, camera, renderer, makeTag, projectTag, setBadge } = makeRenderer(stage, { badgeMode: 'all' })
      camera.position.set(0, 3.5, 10)
      camera.lookAt(0, 1.2, -4)
      const yearTotals = years.map((y) => sum(rowsAt(y), 'revenue'))
      const maxY = Math.max(1, ...yearTotals)
      const gates = []
      years.forEach((year, i) => {
        const h = 0.5 + (yearTotals[i] / maxY) * 4.2
        const yearHex = colorOf.year(year)
        const yearColor = threeOf(yearHex)
        const group = new THREE.Group()
        const left = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, h, 0.25),
          new THREE.MeshStandardMaterial({
            color: dark ? 0x1e293b : 0xffffff,
            emissive: yearColor.clone().multiplyScalar(0.2),
          }),
        )
        const right = left.clone()
        left.position.set(-1.4, h / 2, -i * 2.4)
        right.position.set(1.4, h / 2, -i * 2.4)
        const lintel = new THREE.Mesh(
          new THREE.BoxGeometry(3.1, 0.18, 0.25),
          new THREE.MeshStandardMaterial({
            color: yearColor,
            emissive: yearColor.clone().multiplyScalar(0.35),
          }),
        )
        lintel.position.set(0, h + 0.1, -i * 2.4)
        group.add(left, right, lintel)
        scene.add(group)
        gates.push({
          group,
          h,
          z: -i * 2.4,
          year,
          tag: makeTag(`${timeKey} ${year}`, format(yearTotals[i]), yearHex),
        })
      })
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(8, years.length * 2.6 + 4),
        new THREE.MeshStandardMaterial({ color: dark ? 0x0b1220 : 0xdbe4ef, roughness: 0.95 }),
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.z = -((years.length - 1) * 1.2)
      scene.add(floor)
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        const travel = (Math.sin(t * 0.25) * 0.5 + 0.5) * Math.max(0, years.length - 1)
        camera.position.z = 10 - travel * 2.1
        camera.lookAt(0, 1.4, camera.position.z - 8)
        const focus = Math.round(travel)
        setBadge(`Focus ${timeKey}`, String(years[focus] ?? latest))
        gates.forEach((g, i) => {
          const dist = Math.abs(i - travel)
          const lit = dist < 0.65
          g.group.children.forEach((child) => {
            if (child.material?.emissive) child.material.emissiveIntensity = lit ? 0.85 : 0.15
          })
          const near = dist < 1.25
          g.tag.style.opacity = near ? String(1 - dist * 0.35) : '0'
          if (near) projectTag(g.tag, anchor.set(0, g.h + 0.55, g.z))
          else g.tag.style.display = 'none'
        })
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    // —— Lattice ——
    {
      const stage = board.querySelector('[data-scene="lattice"]')
      const { scene, camera, renderer, makeTag, setTag, projectTag, setBadge } = makeRenderer(stage)
      camera.position.set(10, 12, 14)
      camera.lookAt(0, 0, 0)
      const catList = categories.slice(0, 6)
      const regList = regions.slice(0, 6)
      const cells = []
      const axisTags = []
      regList.forEach((region, xi) => {
        const x = (xi - (regList.length - 1) / 2) * 1.15
        axisTags.push({
          tag: makeTag(region, null, colorOf.region(region)),
          pos: new THREE.Vector3(x, 0.2, (catList.length / 2) * 1.15 + 0.6),
        })
      })
      catList.forEach((category, zi) => {
        const z = (zi - (catList.length - 1) / 2) * 1.15
        axisTags.push({
          tag: makeTag(category, null, colorOf.category(category)),
          pos: new THREE.Vector3(-(regList.length / 2) * 1.15 - 0.7, 0.2, z),
        })
      })
      regList.forEach((region, xi) => {
        catList.forEach((category, zi) => {
          const hex = colorOf.category(category)
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 1, 0.7),
            new THREE.MeshStandardMaterial({
              color: threeOf(hex),
              emissive: new THREE.Color(accent).multiplyScalar(0.1),
              roughness: 0.45,
            }),
          )
          const x = (xi - (regList.length - 1) / 2) * 1.15
          const z = (zi - (catList.length - 1) / 2) * 1.15
          mesh.position.set(x, 0.5, z)
          scene.add(mesh)
          cells.push({ mesh, region, category, base: 1, phase: xi * 0.4 + zi * 0.3, x, z })
        })
      })
      const peakTag = makeTag('peak', '', colorOf.accent)
      peakTag.classList.add('is-core')
      let peakAnchor = { x: 0, h: 1, z: 0 }
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(regList.length * 1.3, 0.08, catList.length * 1.3),
        new THREE.MeshStandardMaterial({ color: dark ? 0x111827 : 0xdbe4ef, roughness: 1 }),
      )
      plate.position.y = -0.04
      scene.add(plate)
      const apply = (m) => {
        setBadge(`Showing ${timeKey}`, m.year)
        const cellMap = new Map()
        for (const r of m.rows) {
          const key = `${r.region}||${r.category}`
          cellMap.set(key, (cellMap.get(key) || 0) + r.revenue)
        }
        const maxCell = Math.max(1, ...cellMap.values(), 1)
        let best = null
        let bestVal = -1
        for (const c of cells) {
          const v = cellMap.get(`${c.region}||${c.category}`) || 0
          c.base = 0.15 + (v / maxCell) * 4.5
          c.mesh.material.color.copy(threeOf(colorOf.category(c.category)))
          c.mesh.material.color.offsetHSL(0, 0, (v / maxCell) * 0.12 - 0.06)
          c.mesh.material.emissive = new THREE.Color(accent).multiplyScalar(0.05 + (v / maxCell) * 0.2)
          if (v > bestVal) {
            bestVal = v
            best = c
          }
        }
        if (best) {
          setTag(peakTag, `${best.region} · ${best.category}`, `${format(bestVal)} · ${m.year}`)
          peakAnchor = { x: best.x, h: best.base, z: best.z }
        }
      }
      yearListeners.push(apply)
      apply(snap)
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        camera.position.x = 10 * Math.cos(t * 0.18)
        camera.position.z = 14 * Math.sin(t * 0.18)
        camera.lookAt(0, 1.2, 0)
        for (const c of cells) {
          const pulse = 1 + Math.sin(t * 1.4 + c.phase) * 0.04
          c.mesh.scale.y = c.base * pulse
          c.mesh.position.y = (c.base * pulse) / 2
        }
        for (const a of axisTags) projectTag(a.tag, a.pos, -40)
        projectTag(peakTag, anchor.set(peakAnchor.x, peakAnchor.h + 0.4, peakAnchor.z))
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    // —— Helix (all years) ——
    {
      const stage = board.querySelector('[data-scene="helix"]')
      const { scene, camera, renderer, makeTag, projectTag, setBadge } = makeRenderer(stage, { badgeMode: 'all' })
      camera.position.set(0, 4, 14)
      camera.lookAt(0, 3, 0)
      const yearTotals = years.map((y) => sum(rowsAt(y), 'revenue'))
      const maxY = Math.max(1, ...yearTotals)
      const beads = []
      years.forEach((year, i) => {
        const weight = yearTotals[i] / maxY
        const hex = colorOf.year(year)
        const color = threeOf(hex)
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.28 + weight * 0.45, 18, 18),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color.clone().multiplyScalar(0.25 + weight * 0.25),
            roughness: 0.3,
          }),
        )
        scene.add(mesh)
        beads.push({
          mesh,
          i,
          weight,
          year,
          tag: makeTag(`${timeKey} ${year}`, format(yearTotals[i]), hex),
        })
      })
      const curvePts = []
      for (let i = 0; i < years.length; i++) {
        const a = (i / Math.max(1, years.length - 1)) * Math.PI * 3.2
        const r = 1.2 + (yearTotals[i] / maxY) * 2.8
        curvePts.push(new THREE.Vector3(Math.cos(a) * r, i * 1.15, Math.sin(a) * r))
      }
      if (curvePts.length > 1) {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(curvePts),
          new THREE.LineBasicMaterial({ color: dark ? 0x64748b : 0x94a3b8 }),
        )
        scene.add(line)
      }
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        let nearest = 0
        let nearestD = Infinity
        for (const b of beads) {
          const a = (b.i / Math.max(1, years.length - 1)) * Math.PI * 3.2 + t * 0.35
          const r = 1.2 + b.weight * 2.8
          b.mesh.position.set(Math.cos(a) * r, b.i * 1.15, Math.sin(a) * r)
          const d = b.mesh.position.distanceTo(camera.position)
          if (d < nearestD) {
            nearestD = d
            nearest = b.i
          }
        }
        setBadge(`Focus ${timeKey}`, String(years[nearest] ?? latest))
        for (const b of beads) {
          const near = Math.abs(b.i - nearest) <= 1
          b.tag.style.opacity = near ? '1' : '0.25'
          if (near || years.length <= 4) {
            projectTag(b.tag, anchor.copy(b.mesh.position).setY(b.mesh.position.y + 0.45))
          } else {
            b.tag.style.display = 'none'
          }
        }
        camera.position.x = Math.sin(t * 0.2) * 3
        camera.lookAt(0, years.length * 0.45, 0)
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    // —— Finale ——
    {
      const stage = board.querySelector('[data-scene="finale"]')
      const { scene, camera, renderer, point, makeTag, setTag, projectTag, setBadge } = makeRenderer(stage)
      camera.position.set(0, 5, 16)
      camera.lookAt(0, 1, 0)
      const core = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.4, 0),
        new THREE.MeshStandardMaterial({
          color: accent,
          emissive: new THREE.Color(accent).multiplyScalar(0.4),
          metalness: 0.5,
          roughness: 0.25,
          flatShading: true,
        }),
      )
      scene.add(core)
      const revTag = makeTag(`${measureKey}`, format(snap.totalRev), colorOf.accent)
      revTag.classList.add('is-core')
      const ordTag = makeTag(ordersKey, format(snap.totalOrd), colorOf.orders)
      const dimTag = makeTag(
        `${regions.length} ${regionKey}s · ${categories.length} ${categoryKey}s`,
        `${channels.length} ${channelKey}s`,
        colorOf.region(regions[0]),
      )
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(2.2 + i * 0.7, 0.04, 8, 80),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.08 + i * 0.12, 0.6, 0.55),
            emissive: new THREE.Color(accent).multiplyScalar(0.1),
          }),
        )
        ring.rotation.x = Math.PI / 2.2 + i * 0.2
        ring.userData.speed = 0.15 + i * 0.08
        scene.add(ring)
        frames.push((t) => {
          ring.rotation.z = t * ring.userData.speed
        })
      }
      const SPARK = 1200
      const pos = new Float32Array(SPARK * 3)
      for (let i = 0; i < SPARK; i++) {
        const r = 3 + Math.random() * 8
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
        pos[i * 3 + 1] = r * Math.cos(ph) * 0.6
        pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
      }
      const sparks = new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
        new THREE.PointsMaterial({
          size: 0.08,
          color: accent,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
      )
      scene.add(sparks)
      let scale = 1
      yearListeners.push((m) => {
        setBadge(`Showing ${timeKey}`, m.year)
        scale = 0.85 + Math.min(1.4, m.totalRev / Math.max(1, firstRev || m.totalRev))
        core.scale.setScalar(scale)
        setTag(revTag, `${measureKey} · ${m.year}`, format(m.totalRev))
        setTag(ordTag, `${ordersKey} · ${m.year}`, format(m.totalOrd))
        setTag(dimTag, `${regions.length} ${regionKey}s · ${categories.length} ${categoryKey}s`, `${channels.length} ${channelKey}s`)
      })
      setBadge(`Showing ${timeKey}`, snap.year)
      scale = 0.85 + Math.min(1.4, snap.totalRev / Math.max(1, firstRev || snap.totalRev))
      core.scale.setScalar(scale)
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        core.rotation.y = t * 0.4
        core.rotation.x = Math.sin(t * 0.3) * 0.2
        sparks.rotation.y = t * 0.08
        point.intensity = 1.2 + Math.sin(t * 2.2) * 0.35
        camera.position.x = Math.sin(t * 0.15) * 2
        camera.lookAt(0, 1, 0)
        projectTag(revTag, anchor.set(0, 2.1 * scale, 0))
        projectTag(ordTag, anchor.set(2.8, 0.4, 0), -40)
        projectTag(dimTag, anchor.set(-2.8, -0.2, 0), -40)
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    let raf = 0
    let last = performance.now()
    const animate = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      for (const fn of frames) fn(t, dt)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    cleanups.push(() => cancelAnimationFrame(raf))

    board.querySelectorAll('.msv-nav a').forEach((a) => {
      const onClick = (e) => {
        e.preventDefault()
        const id = a.getAttribute('href')?.slice(1)
        const el = id ? board.querySelector(`#${CSS.escape(id)}`) : null
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      a.addEventListener('click', onClick)
      cleanups.push(() => a.removeEventListener('click', onClick))
    })

    setYearIndex(years.length - 1)

    const syncViewport = () => reportHeight(VIEWPORT)
    requestAnimationFrame(() => {
      syncViewport()
      onScroll()
    })
    const pageRo = new ResizeObserver(syncViewport)
    pageRo.observe(board)
    cleanups.push(() => pageRo.disconnect())

    return () => {
      for (const fn of cleanups.reverse()) fn()
    }
  },
}
