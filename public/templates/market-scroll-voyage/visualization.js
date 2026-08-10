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
        display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 28px;
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
      .msv-stage { width: 100%; height: clamp(420px, 72vh, 820px); }
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
        .msv-bar-row { grid-template-columns: 5rem 1fr 3rem; }
      }
    `
    document.head.appendChild(styles)
    cleanups.push(() => styles.remove())

    const latestRows = rowsAt(latest)
    const firstRows = rowsAt(earliest)
    const totalRev = sum(latestRows, 'revenue')
    const totalOrd = sum(latestRows, 'orders')
    const totalCus = sum(latestRows, 'customers')
    const avgMargin =
      latestRows.reduce((a, r) => a + r.margin * r.revenue, 0) / Math.max(1, totalRev)
    const firstRev = sum(firstRows, 'revenue')
    const growthPct = firstRev > 0 ? ((totalRev - firstRev) / firstRev) * 100 : 0

    const regionRev = groupSum(latestRows, 'revenue', 'region')
    const catRev = groupSum(latestRows, 'revenue', 'category')
    const channelOrd = groupSum(latestRows, 'orders', 'channel')
    const maxRegion = Math.max(1, ...regions.map((r) => regionRev.get(r) || 0))
    const maxCat = Math.max(1, ...categories.map((c) => catRev.get(c) || 0))

    const regionCards = regions
      .map((r) => {
        const v = regionRev.get(r) || 0
        return `<div class="msv-card"><span>${r}</span><strong>${format(v)}</strong><em>${((v / maxRegion) * 100).toFixed(0)}% of top region</em></div>`
      })
      .join('')

    const catBars = [...categories]
      .sort((a, b) => (catRev.get(b) || 0) - (catRev.get(a) || 0))
      .map((c) => {
        const v = catRev.get(c) || 0
        const pct = (v / maxCat) * 100
        return `<div class="msv-bar-row"><span>${c}</span><div class="msv-bar-track"><div class="msv-bar-fill" style="width:${pct}%"></div></div><strong>${format(v)}</strong></div>`
      })
      .join('')

    const yearCards = years
      .map((y) => {
        const v = sum(rowsAt(y), 'revenue')
        return `<div class="msv-card"><span>${y}</span><strong>${format(v)}</strong><em>${format(sum(rowsAt(y), 'orders'))} orders</em></div>`
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
          <p>Eight Three.js chapters on one tall page — keep scrolling through orbit, skyline, constellation, river, corridor, lattice, helix, and finale.</p>
        </div>
        <div class="msv-kpis">
          <div class="msv-kpi"><span>Revenue · ${latest}</span><strong>${format(totalRev)}</strong></div>
          <div class="msv-kpi"><span>Orders</span><strong>${format(totalOrd)}</strong></div>
          <div class="msv-kpi"><span>Customers</span><strong>${format(totalCus)}</strong></div>
          <div class="msv-kpi"><span>Growth ${earliest}→${latest}</span><strong>${growthPct >= 0 ? '+' : ''}${format(growthPct)}%</strong></div>
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

      <section class="msv-chapter" id="msv-orbit">
        <div class="msv-chapter-head">
          <em>Chapter 01</em>
          <h2>Global orbit</h2>
          <p>A living core sized by latest-year revenue — moons mark active regions.</p>
        </div>
        <div class="msv-stage" data-scene="orbit"></div>
      </section>

      <section class="msv-chapter" id="msv-skyline">
        <div class="msv-chapter-head">
          <em>Chapter 02</em>
          <h2>Region skyline</h2>
          <p>Each tower is a region. Height follows mapped revenue for ${latest}. Drag sideways to orbit.</p>
        </div>
        <div class="msv-stage" data-scene="skyline"></div>
      </section>

      <section class="msv-panel" id="msv-brief-regions">
        <h3>Region brief · ${latest}</h3>
        <p>Pause between scenes — these cards mirror the skyline towers with compact numbers from your mapped rows.</p>
        <div class="msv-grid">${regionCards}</div>
      </section>

      <section class="msv-chapter" id="msv-constellation">
        <div class="msv-chapter-head">
          <em>Chapter 03</em>
          <h2>Category constellation</h2>
          <p>Product lines as orbiting stars — brighter, larger nodes carry more revenue.</p>
        </div>
        <div class="msv-stage" data-scene="constellation"></div>
      </section>

      <section class="msv-chapter" id="msv-river">
        <div class="msv-chapter-head">
          <em>Chapter 04</em>
          <h2>Channel river</h2>
          <p>Particle streams colored by channel; density and lift follow order share.</p>
        </div>
        <div class="msv-stage" data-scene="river"></div>
      </section>

      <section class="msv-panel" id="msv-brief-mix">
        <h3>Category mix · ${latest}</h3>
        <p>Horizontal share bars for the constellation chapter — same revenue roles, flat reading.</p>
        <div class="msv-bars">${catBars}</div>
        <p style="margin-top:16px;margin-bottom:8px">Avg margin across mapped rows: <strong style="color:var(--text)">${format(avgMargin)}%</strong></p>
      </section>

      <section class="msv-chapter" id="msv-corridor">
        <div class="msv-chapter-head">
          <em>Chapter 05</em>
          <h2>Timeline corridor</h2>
          <p>Walk the years — gates light as the camera travels ${earliest} → ${latest}.</p>
        </div>
        <div class="msv-stage" data-scene="corridor"></div>
      </section>

      <section class="msv-chapter" id="msv-lattice">
        <div class="msv-chapter-head">
          <em>Chapter 06</em>
          <h2>Region × category lattice</h2>
          <p>A glowing grid of cells — each column a region, each row a category, height from revenue.</p>
        </div>
        <div class="msv-stage" data-scene="lattice"></div>
      </section>

      <section class="msv-chapter" id="msv-helix">
        <div class="msv-chapter-head">
          <em>Chapter 07</em>
          <h2>Growth helix</h2>
          <p>Years climb a spiral — radius tracks revenue so growth years flare outward.</p>
        </div>
        <div class="msv-stage" data-scene="helix"></div>
      </section>

      <section class="msv-panel" id="msv-brief-years">
        <h3>Year ledger</h3>
        <p>Every mapped year as a card before the finale — useful when scrubbing the corridor mentally.</p>
        <div class="msv-grid">${yearCards}</div>
      </section>

      <section class="msv-chapter" id="msv-finale">
        <div class="msv-chapter-head">
          <em>Chapter 08</em>
          <h2>Market finale</h2>
          <p>All signals at once — core, rings, and spark field scaled by your latest totals.</p>
        </div>
        <div class="msv-stage" data-scene="finale"></div>
      </section>

      <div class="msv-foot">
        End of voyage · ${payload.rows.length} mapped rows · ${years.length} years · ${regions.length} regions · ${categories.length} categories · ${channels.length} channels
      </div>
    `
    board.querySelector('h1').textContent = payload.title || 'Market scroll voyage'
    root.appendChild(board)
    cleanups.push(() => board.remove())

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

    const makeRenderer = (stage) => {
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(dark ? 0x070d18 : 0xeef3f8)
      scene.fog = new THREE.Fog(scene.background.getHex(), 18, 48)
      const camera = new THREE.PerspectiveCamera(42, stage.clientWidth / Math.max(1, stage.clientHeight), 0.1, 140)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
      renderer.setSize(stage.clientWidth, stage.clientHeight)
      stage.appendChild(renderer.domElement)
      scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x0b1220 : 0x94a3b8, 1.35))
      const key = new THREE.DirectionalLight(0xffffff, 2.1)
      key.position.set(5, 12, 8)
      scene.add(key)
      const point = new THREE.PointLight(accent, 1.2, 50)
      point.position.set(-3, 5, -4)
      scene.add(point)
      return { scene, camera, renderer, point }
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

    // —— Orbit ——
    {
      const stage = board.querySelector('[data-scene="orbit"]')
      const { scene, camera, renderer, point } = makeRenderer(stage)
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
      regions.slice(0, 6).forEach((_, i) => {
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 16, 16),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.08 + i * 0.1, 0.7, 0.55),
            emissive: new THREE.Color().setHSL(0.08 + i * 0.1, 0.7, 0.25),
          }),
        )
        scene.add(moon)
        moons.push({ mesh: moon, angle: (i / 6) * Math.PI * 2, radius: 3.1 + (i % 3) * 0.25, speed: 0.25 + i * 0.04 })
      })
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        core.rotation.y = t * 0.35
        core.rotation.x = Math.sin(t * 0.4) * 0.15
        ring.rotation.z = t * 0.2
        ring2.rotation.z = -t * 0.12
        point.intensity = 1 + Math.sin(t * 2) * 0.25
        for (const m of moons) {
          const a = m.angle + t * m.speed
          m.mesh.position.set(Math.cos(a) * m.radius, Math.sin(a * 1.4) * 0.45, Math.sin(a) * m.radius)
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
      const { scene, camera, renderer } = makeRenderer(stage)
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
        const h = 0.4 + ((regionRev.get(region) || 0) / maxRegion) * 6.5
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 1, 0.9),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.05 + i * 0.08, 0.65, 0.5),
            emissive: new THREE.Color(accent).multiplyScalar(0.08),
            roughness: 0.4,
          }),
        )
        const x = (i - (regions.length - 1) / 2) * 1.35
        mesh.position.set(x, h / 2, 0)
        mesh.scale.y = h
        scene.add(mesh)
        towers.push(mesh)
      })
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
        for (const mesh of towers) {
          mesh.rotation.y = groupY
          mesh.position.z = Math.sin(groupY + mesh.position.x * 0.2) * 0.15
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
      const { scene, camera, renderer } = makeRenderer(stage)
      camera.position.set(0, 0, 11)
      camera.lookAt(0, 0, 0)
      const stars = []
      categories.forEach((cat, i) => {
        const weight = (catRev.get(cat) || 0) / maxCat
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.2 + weight * 0.55, 20, 20),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.55 + i * 0.07, 0.7, 0.55),
            emissive: new THREE.Color().setHSL(0.55 + i * 0.07, 0.8, 0.25),
            roughness: 0.3,
          }),
        )
        scene.add(mesh)
        stars.push({
          mesh,
          angle: (i / Math.max(1, categories.length)) * Math.PI * 2,
          radius: 2.2 + weight * 1.8,
          speed: 0.15 + weight * 0.25,
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
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        for (const s of stars) {
          const a = s.angle + t * s.speed
          s.mesh.position.set(Math.cos(a) * s.radius, Math.sin(t * 0.8 + s.bob) * 0.7, Math.sin(a) * s.radius)
          if (s.link && s.linkTo) {
            s.link.geometry.setFromPoints([s.mesh.position.clone(), s.linkTo.mesh.position.clone()])
          }
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
      const { scene, camera, renderer } = makeRenderer(stage)
      camera.position.set(0, 7, 14)
      camera.lookAt(0, 0, 0)
      const colors = channels.map((_, i) => new THREE.Color().setHSL(0.5 + i * 0.08, 0.7, 0.55))
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
      bindResize(stage, camera, renderer)
      frames.push((t, dt) => {
        const orderSum = Math.max(1, [...channelOrd.values()].reduce((a, b) => a + b, 0))
        for (let i = 0; i < COUNT; i++) {
          const m = meta[i]
          const share = (channelOrd.get(channels[m.channelIndex]) || 1) / orderSum
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
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    // —— Corridor ——
    {
      const stage = board.querySelector('[data-scene="corridor"]')
      const { scene, camera, renderer } = makeRenderer(stage)
      camera.position.set(0, 3.5, 10)
      camera.lookAt(0, 1.2, -4)
      const yearTotals = years.map((y) => sum(rowsAt(y), 'revenue'))
      const maxY = Math.max(1, ...yearTotals)
      const gates = []
      years.forEach((year, i) => {
        const h = 0.5 + (yearTotals[i] / maxY) * 4.2
        const group = new THREE.Group()
        const left = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, h, 0.25),
          new THREE.MeshStandardMaterial({ color: dark ? 0x1e293b : 0xffffff, emissive: new THREE.Color(accent).multiplyScalar(0.12) }),
        )
        const right = left.clone()
        left.position.set(-1.4, h / 2, -i * 2.4)
        right.position.set(1.4, h / 2, -i * 2.4)
        const lintel = new THREE.Mesh(
          new THREE.BoxGeometry(3.1, 0.18, 0.25),
          new THREE.MeshStandardMaterial({ color: accent, emissive: new THREE.Color(accent).multiplyScalar(0.25) }),
        )
        lintel.position.set(0, h + 0.1, -i * 2.4)
        group.add(left, right, lintel)
        scene.add(group)
        gates.push({ group, year, h })
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
        const travel = (Math.sin(t * 0.25) * 0.5 + 0.5) * (years.length - 1)
        camera.position.z = 10 - travel * 2.1
        camera.lookAt(0, 1.4, camera.position.z - 8)
        gates.forEach((g, i) => {
          const lit = Math.abs(i - travel) < 0.65
          g.group.children.forEach((child) => {
            if (child.material?.emissive) child.material.emissiveIntensity = lit ? 0.85 : 0.15
          })
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
      const { scene, camera, renderer } = makeRenderer(stage)
      camera.position.set(10, 12, 14)
      camera.lookAt(0, 0, 0)
      const cells = []
      const catList = categories.slice(0, 6)
      const regList = regions.slice(0, 6)
      const cellMap = new Map()
      for (const r of latestRows) {
        const key = `${r.region}||${r.category}`
        cellMap.set(key, (cellMap.get(key) || 0) + r.revenue)
      }
      const maxCell = Math.max(1, ...cellMap.values())
      regList.forEach((region, xi) => {
        catList.forEach((category, zi) => {
          const v = cellMap.get(`${region}||${category}`) || 0
          const h = 0.15 + (v / maxCell) * 4.5
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 1, 0.7),
            new THREE.MeshStandardMaterial({
              color: new THREE.Color().setHSL(0.08 + zi * 0.08, 0.65, 0.45 + (v / maxCell) * 0.2),
              emissive: new THREE.Color(accent).multiplyScalar(0.05 + (v / maxCell) * 0.2),
              roughness: 0.45,
            }),
          )
          mesh.position.set((xi - (regList.length - 1) / 2) * 1.15, h / 2, (zi - (catList.length - 1) / 2) * 1.15)
          mesh.scale.y = h
          scene.add(mesh)
          cells.push({ mesh, base: h, phase: xi * 0.4 + zi * 0.3 })
        })
      })
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(regList.length * 1.3, 0.08, catList.length * 1.3),
        new THREE.MeshStandardMaterial({ color: dark ? 0x111827 : 0xdbe4ef, roughness: 1 }),
      )
      plate.position.y = -0.04
      scene.add(plate)
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
        renderer.render(scene, camera)
      })
      cleanups.push(() => {
        renderer.dispose()
        stage.replaceChildren()
      })
    }

    // —— Helix ——
    {
      const stage = board.querySelector('[data-scene="helix"]')
      const { scene, camera, renderer } = makeRenderer(stage)
      camera.position.set(0, 4, 14)
      camera.lookAt(0, 3, 0)
      const yearTotals = years.map((y) => sum(rowsAt(y), 'revenue'))
      const maxY = Math.max(1, ...yearTotals)
      const beads = []
      years.forEach((year, i) => {
        const weight = yearTotals[i] / maxY
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.28 + weight * 0.45, 18, 18),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.08 + i * 0.06, 0.75, 0.55),
            emissive: new THREE.Color(accent).multiplyScalar(0.15 + weight * 0.25),
            roughness: 0.3,
          }),
        )
        scene.add(mesh)
        beads.push({ mesh, i, weight, year })
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
        for (const b of beads) {
          const a = (b.i / Math.max(1, years.length - 1)) * Math.PI * 3.2 + t * 0.35
          const r = 1.2 + b.weight * 2.8
          b.mesh.position.set(Math.cos(a) * r, b.i * 1.15, Math.sin(a) * r)
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
      const { scene, camera, renderer, point } = makeRenderer(stage)
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
      const scale = 0.85 + Math.min(1.4, totalRev / Math.max(1, firstRev || totalRev))
      core.scale.setScalar(scale)
      bindResize(stage, camera, renderer)
      frames.push((t) => {
        core.rotation.y = t * 0.4
        core.rotation.x = Math.sin(t * 0.3) * 0.2
        sparks.rotation.y = t * 0.08
        point.intensity = 1.2 + Math.sin(t * 2.2) * 0.35
        camera.position.x = Math.sin(t * 0.15) * 2
        camera.lookAt(0, 1, 0)
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
