/*
 * DataCheetah Three.js pack — Commerce Command Center
 *
 * Region platforms on a ring, category towers, channel particle flows,
 * and a multi-KPI HUD. CSV → DuckDB → mapped roles → payload.
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

    const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
    const text = (value) => (value == null || value === '' ? '—' : String(value))
    const format = (value) =>
      new Intl.NumberFormat(undefined, {
        notation: Math.abs(value) >= 10000 ? 'compact' : 'standard',
        maximumFractionDigits: 1,
      }).format(value)

    /** year -> region -> { revenue, orders, customers, marginSum, marginW, categories: Map, channels: Map } */
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

      if (!byYear.has(year)) byYear.set(year, new Map())
      const regions = byYear.get(year)
      if (!regions.has(region)) {
        regions.set(region, {
          revenue: 0,
          orders: 0,
          customers: 0,
          marginSum: 0,
          marginW: 0,
          categories: new Map(),
          channels: new Map(),
        })
      }
      const bucket = regions.get(region)
      const revenue = number(row[measureKey])
      const orders = number(row[ordersKey])
      const customers = number(row[customersKey])
      const margin = number(row[marginKey])
      bucket.revenue += revenue
      bucket.orders += orders
      bucket.customers += customers
      if (margin) {
        bucket.marginSum += margin * revenue
        bucket.marginW += revenue
      }
      if (category !== '—') {
        bucket.categories.set(category, (bucket.categories.get(category) || 0) + revenue)
      }
      if (channel !== '—') {
        const ch = bucket.channels.get(channel) || { revenue: 0, orders: 0 }
        ch.revenue += revenue
        ch.orders += orders
        bucket.channels.set(channel, ch)
      }
    }

    const years = [...byYear.keys()].sort((a, b) => Number(a) - Number(b))
    const regions = [...regionSet].slice(0, 8)
    const categories = [...categorySet].slice(0, 6)
    const channels = [...channelSet].slice(0, 5)

    if (years.length < 1 || !regions.length) {
      root.textContent = 'Need year + region (+ measures) rows for the command center'
      reportHeight()
      return () => {}
    }

    const maxRevenue = Math.max(
      1,
      ...years.flatMap((year) => regions.map((r) => byYear.get(year)?.get(r)?.revenue || 0)),
    )

    const dark = payload.theme === 'dark'
    const accent = 0xf2a01f
    const channelColors = channels.map((_, i) =>
      new THREE.Color().setHSL(0.55 + (i / Math.max(1, channels.length)) * 0.35, 0.7, 0.55),
    )
    const categoryColors = categories.map((_, i) =>
      new THREE.Color().setHSL(0.08 + (i / Math.max(1, categories.length)) * 0.45, 0.72, 0.5),
    )

    const styles = document.createElement('style')
    styles.textContent = `
      .ccc { position: relative; max-width: 1180px; margin: 0 auto; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--card); }
      .ccc-head { display: flex; justify-content: space-between; gap: 16px; padding: 16px 18px 8px; }
      .ccc-head small { color: var(--accent); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .ccc-head h1 { margin: 4px 0 2px; font-size: 21px; }
      .ccc-head p { margin: 0; color: var(--muted); font-size: 12px; max-width: 36rem; }
      .ccc-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; min-width: min(100%, 22rem); }
      .ccc-kpi { padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); }
      .ccc-kpi span { display: block; color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
      .ccc-kpi strong { display: block; margin-top: 2px; font-size: 15px; font-variant-numeric: tabular-nums; }
      .ccc-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 0 18px 10px; }
      .ccc-controls button { height: 32px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); padding: 0 12px; font-weight: 700; cursor: pointer; }
      .ccc-controls input[type="range"] { flex: 1; min-width: 140px; accent-color: var(--accent); }
      .ccc-year { min-width: 3.5rem; font-weight: 800; font-variant-numeric: tabular-nums; }
      .ccc-leader { color: var(--muted); font-size: 11px; margin-left: auto; }
      .ccc-stage { position: relative; width: 100%; height: clamp(420px, 62vh, 78vh); cursor: grab; }
      .ccc-stage:active { cursor: grabbing; }
      .ccc-labels { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
      .ccc-label {
        position: absolute; left: 0; top: 0; z-index: 2;
        display: flex; flex-direction: column; gap: 1px;
        max-width: 9.5rem; padding: 4px 8px;
        border: 1px solid color-mix(in srgb, var(--chip, #888) 40%, var(--border));
        border-radius: 10px;
        background: color-mix(in srgb, var(--card) 90%, transparent);
        box-shadow: 0 6px 18px rgba(0,0,0,.14);
        color: var(--text); font-size: 10px; font-weight: 750;
        white-space: nowrap; transform: translate(-50%, -120%);
        backdrop-filter: blur(6px);
      }
      .ccc-label.is-leader { border-color: var(--accent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 8px 18px rgba(0,0,0,.16); }
      .ccc-label.is-focus { outline: 1px solid var(--accent); }
      .ccc-label em { color: var(--muted); font-style: normal; font-weight: 650; font-size: 9px; }
      .ccc-side {
        display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px;
        padding: 0 18px 14px;
      }
      .ccc-panel { border: 1px solid var(--border); border-radius: 12px; background: var(--bg); padding: 10px 12px; }
      .ccc-panel h3 { margin: 0 0 8px; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
      .ccc-mix { display: flex; flex-direction: column; gap: 6px; }
      .ccc-mix-row { display: grid; grid-template-columns: 7rem 1fr 2.8rem; gap: 8px; align-items: center; font-size: 10px; }
      .ccc-mix-row i { display: inline-block; width: 8px; height: 8px; margin-right: 5px; border-radius: 50%; vertical-align: middle; }
      .ccc-bar { height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--border) 70%, transparent); overflow: hidden; }
      .ccc-bar span { display: block; height: 100%; border-radius: inherit; }
      .ccc-cats { display: flex; flex-wrap: wrap; gap: 6px; }
      .ccc-chip { padding: 4px 8px; border-radius: 999px; border: 1px solid var(--border); background: var(--card); font-size: 10px; color: var(--muted); }
      .ccc-chip b { color: var(--text); }
      .ccc-tooltip {
        position: absolute; z-index: 4; display: none; max-width: 220px;
        transform: translate(12px, 12px);
        border: 1px solid var(--border); border-radius: 10px; background: var(--card);
        padding: 8px 10px; box-shadow: 0 10px 28px rgba(0,0,0,.2); pointer-events: none; font-size: 11px;
      }
      .ccc-tooltip strong { display: block; margin-bottom: 4px; }
      @media (max-width: 720px) {
        .ccc-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .ccc-side { grid-template-columns: 1fr; }
        .ccc-stage { height: clamp(380px, 55vh, 70vh); }
      }
    `
    document.head.appendChild(styles)

    const board = document.createElement('main')
    board.className = 'ccc'
    board.innerHTML = `
      <header class="ccc-head">
        <div>
          <small>Custom visualization.js</small>
          <h1></h1>
          <p>Regions · categories · channels · multi-KPI floor — scrub years to command the scene</p>
        </div>
        <div class="ccc-kpis">
          <div class="ccc-kpi"><span>Revenue</span><strong class="ccc-rev">0</strong></div>
          <div class="ccc-kpi"><span>Orders</span><strong class="ccc-ord">0</strong></div>
          <div class="ccc-kpi"><span>Customers</span><strong class="ccc-cus">0</strong></div>
          <div class="ccc-kpi"><span>Avg margin</span><strong class="ccc-mar">0%</strong></div>
        </div>
      </header>
      <div class="ccc-controls">
        <button type="button" class="ccc-play">Pause</button>
        <input class="ccc-scrub" type="range" min="0" max="${Math.max(0, years.length - 1) * 100}" step="1" value="0" />
        <span class="ccc-year">${years[0]}</span>
        <span class="ccc-leader"></span>
      </div>
      <div class="ccc-stage">
        <div class="ccc-labels" aria-hidden="true"></div>
        <div class="ccc-tooltip"></div>
      </div>
      <div class="ccc-side">
        <div class="ccc-panel">
          <h3>Channel mix</h3>
          <div class="ccc-mix"></div>
        </div>
        <div class="ccc-panel">
          <h3>Top categories</h3>
          <div class="ccc-cats"></div>
        </div>
      </div>
    `
    board.querySelector('h1').textContent = payload.title || 'Commerce command center'
    root.appendChild(board)

    const stage = board.querySelector('.ccc-stage')
    const labelsLayer = board.querySelector('.ccc-labels')
    const tooltip = board.querySelector('.ccc-tooltip')
    const playBtn = board.querySelector('.ccc-play')
    const scrub = board.querySelector('.ccc-scrub')
    const yearLabel = board.querySelector('.ccc-year')
    const leaderLabel = board.querySelector('.ccc-leader')
    const mixEl = board.querySelector('.ccc-mix')
    const catsEl = board.querySelector('.ccc-cats')
    const revEl = board.querySelector('.ccc-rev')
    const ordEl = board.querySelector('.ccc-ord')
    const cusEl = board.querySelector('.ccc-cus')
    const marEl = board.querySelector('.ccc-mar')

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(dark ? 0x070d18 : 0xeef3f8)
    scene.fog = new THREE.Fog(scene.background.getHex(), 22, 48)

    const camera = new THREE.PerspectiveCamera(40, stage.clientWidth / stage.clientHeight, 0.1, 120)
    camera.position.set(0, 14, 20)
    camera.lookAt(0, 1.2, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(stage.clientWidth, stage.clientHeight)
    stage.insertBefore(renderer.domElement, labelsLayer)

    scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x0b1220 : 0x94a3b8, dark ? 1.2 : 1.6))
    const key = new THREE.DirectionalLight(0xffffff, dark ? 2.4 : 2.0)
    key.position.set(6, 16, 8)
    scene.add(key)
    const rim = new THREE.PointLight(accent, 1.4, 40)
    rim.position.set(-4, 6, -6)
    scene.add(rim)

    const floor = new THREE.Group()
    scene.add(floor)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(11.5, 64),
      new THREE.MeshStandardMaterial({
        color: dark ? 0x0f172a : 0xdbe4ef,
        roughness: 0.92,
        metalness: 0.05,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    floor.add(ground)

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.2, 0.04, 8, 96),
      new THREE.MeshStandardMaterial({
        color: accent,
        emissive: new THREE.Color(accent).multiplyScalar(0.35),
        roughness: 0.4,
      }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.05
    floor.add(ring)

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 0.35, 24),
      new THREE.MeshStandardMaterial({
        color: dark ? 0x1e293b : 0xffffff,
        emissive: new THREE.Color(accent).multiplyScalar(0.2),
        roughness: 0.35,
        metalness: 0.4,
      }),
    )
    hub.position.y = 0.2
    floor.add(hub)

    // Grid ticks
    for (let i = 1; i <= 3; i++) {
      const g = new THREE.Mesh(
        new THREE.RingGeometry(2.2 * i, 2.2 * i + 0.02, 64),
        new THREE.MeshBasicMaterial({
          color: dark ? 0x1e293b : 0xcbd5e1,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        }),
      )
      g.rotation.x = -Math.PI / 2
      g.position.y = 0.02
      floor.add(g)
    }

    const radius = 7.2
    const pads = []
    const particleGeo = new THREE.BufferGeometry()
    const PARTICLE_COUNT = 900
    const particlePos = new Float32Array(PARTICLE_COUNT * 3)
    const particleCol = new Float32Array(PARTICLE_COUNT * 3)
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3))
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        size: 0.09,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    )
    floor.add(particles)

    const particleMeta = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particleMeta.push({
        regionIndex: i % Math.max(1, regions.length),
        channelIndex: i % Math.max(1, channels.length),
        t: Math.random(),
        speed: 0.18 + Math.random() * 0.35,
      })
    }

    regions.forEach((region, index) => {
      const angle = (index / regions.length) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const group = new THREE.Group()
      group.position.set(x, 0, z)
      floor.add(group)

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.25, 0.22, 6),
        new THREE.MeshStandardMaterial({
          color: dark ? 0x1e293b : 0xffffff,
          roughness: 0.45,
          metalness: 0.15,
        }),
      )
      pad.position.y = 0.12
      pad.userData = { region, kind: 'pad' }
      group.add(pad)

      const towers = categories.map((category, cIndex) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 1, 0.28),
          new THREE.MeshStandardMaterial({
            color: categoryColors[cIndex],
            emissive: categoryColors[cIndex].clone().multiplyScalar(0.2),
            roughness: 0.4,
          }),
        )
        const ox = ((cIndex % 2) - 0.5) * 0.55
        const oz = (Math.floor(cIndex / 2) - 0.5) * 0.55
        mesh.position.set(ox, 0.4, oz)
        mesh.userData = { region, category, kind: 'tower' }
        group.add(mesh)
        return { category, mesh }
      })

      const label = document.createElement('div')
      label.className = 'ccc-label'
      label.innerHTML = `<b></b><em></em>`
      label.querySelector('b').textContent = region
      labelsLayer.appendChild(label)

      pads.push({
        region,
        angle,
        group,
        pad,
        towers,
        label,
        anchor: new THREE.Vector3(x, 1.8, z),
        revenue: 0,
        orders: 0,
        customers: 0,
        margin: 0,
      })
    })

    let progress = 0
    let playing = years.length > 1
    let frame = 0
    let dragging = false
    let previousX = 0
    let targetRotY = 0.25
    let focusRegion = null
    const tmp = new THREE.Vector3()
    const SPEED = 0.28

    const sampleYearMaps = (t) => {
      const i0 = Math.floor(t)
      const i1 = Math.min(i0 + 1, years.length - 1)
      const f = years.length < 2 ? 0 : t - i0
      return { i0, i1, f, y0: years[i0], y1: years[i1] }
    }

    const lerpBucket = (region, t) => {
      const { y0, y1, f } = sampleYearMaps(t)
      const a = byYear.get(y0)?.get(region)
      const b = byYear.get(y1)?.get(region)
      const empty = {
        revenue: 0,
        orders: 0,
        customers: 0,
        margin: 0,
        categories: new Map(),
        channels: new Map(),
      }
      if (!a && !b) return empty
      const A = a || empty
      const B = b || a || empty
      const marginA = A.marginW ? A.marginSum / A.marginW : 0
      const marginB = B.marginW ? B.marginSum / B.marginW : marginA
      const categoriesMap = new Map()
      for (const cat of categories) {
        const va = A.categories?.get(cat) || 0
        const vb = B.categories?.get(cat) || 0
        categoriesMap.set(cat, va + (vb - va) * f)
      }
      const channelsMap = new Map()
      for (const ch of channels) {
        const ca = A.channels?.get(ch) || { revenue: 0, orders: 0 }
        const cb = B.channels?.get(ch) || ca
        channelsMap.set(ch, {
          revenue: ca.revenue + (cb.revenue - ca.revenue) * f,
          orders: ca.orders + (cb.orders - ca.orders) * f,
        })
      }
      return {
        revenue: (A.revenue || 0) + ((B.revenue || 0) - (A.revenue || 0)) * f,
        orders: (A.orders || 0) + ((B.orders || 0) - (A.orders || 0)) * f,
        customers: (A.customers || 0) + ((B.customers || 0) - (A.customers || 0)) * f,
        margin: marginA + (marginB - marginA) * f,
        categories: categoriesMap,
        channels: channelsMap,
      }
    }

    const projectLabel = (entry) => {
      tmp.copy(entry.anchor)
      floor.localToWorld(tmp)
      tmp.project(camera)
      const x = (tmp.x * 0.5 + 0.5) * stage.clientWidth
      const y = (-tmp.y * 0.5 + 0.5) * stage.clientHeight
      const onScreen = tmp.z > -1 && tmp.z < 1
      entry.label.style.display = onScreen ? 'flex' : 'none'
      entry.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -120%)`
    }

    const revealTo = (t) => {
      progress = Math.max(0, Math.min(Math.max(0, years.length - 1), t))
      const { i0, f } = sampleYearMaps(progress)
      const displayYear =
        f < 0.5 || i0 >= years.length - 1 ? years[i0] : years[Math.min(i0 + 1, years.length - 1)]
      yearLabel.textContent = displayYear
      scrub.value = String(Math.round(progress * 100))

      let totalRev = 0
      let totalOrd = 0
      let totalCus = 0
      let marginAcc = 0
      let marginW = 0
      const channelTotals = new Map(channels.map((c) => [c, { revenue: 0, orders: 0 }]))
      const categoryTotals = new Map(categories.map((c) => [c, 0]))

      const ranked = []
      for (const entry of pads) {
        const bucket = lerpBucket(entry.region, progress)
        entry.revenue = bucket.revenue
        entry.orders = bucket.orders
        entry.customers = bucket.customers
        entry.margin = bucket.margin
        ranked.push(entry)
        totalRev += bucket.revenue
        totalOrd += bucket.orders
        totalCus += bucket.customers
        if (bucket.margin && bucket.revenue) {
          marginAcc += bucket.margin * bucket.revenue
          marginW += bucket.revenue
        }
        for (const [ch, vals] of bucket.channels) {
          const cur = channelTotals.get(ch) || { revenue: 0, orders: 0 }
          cur.revenue += vals.revenue
          cur.orders += vals.orders
          channelTotals.set(ch, cur)
        }
        for (const [cat, val] of bucket.categories) {
          categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + val)
        }

        const h = 0.22 + (bucket.revenue / maxRevenue) * 1.35
        entry.pad.scale.y = h / 0.22
        entry.pad.position.y = h / 2
        entry.pad.material.emissive = new THREE.Color(accent).multiplyScalar(
          0.05 + (bucket.margin / 40) * 0.35,
        )
        entry.anchor.set(entry.group.position.x, h + 1.1, entry.group.position.z)

        const maxCat = Math.max(1, ...[...bucket.categories.values()])
        entry.towers.forEach((tower, ti) => {
          const val = bucket.categories.get(tower.category) || 0
          const th = 0.15 + (val / maxCat) * 2.4
          tower.mesh.scale.y = th
          tower.mesh.position.y = 0.22 * entry.pad.scale.y + th / 2 + 0.05
          tower.mesh.material.emissiveIntensity = 0.25 + (bucket.margin / 35) * 0.5
          tower.mesh.visible = categories.length > 0
          void ti
        })

        entry.label.querySelector('em').textContent = format(bucket.revenue)
        entry.label.classList.toggle('is-focus', focusRegion === entry.region)
        entry.label.style.setProperty('--chip', `#${new THREE.Color(accent).getHexString()}`)
      }

      ranked.sort((a, b) => b.revenue - a.revenue)
      const leader = ranked[0]
      for (const entry of pads) {
        entry.label.classList.toggle('is-leader', leader && entry.region === leader.region)
        entry.pad.material.color.set(
          leader && entry.region === leader.region
            ? dark
              ? 0x334155
              : 0xfff7ed
            : dark
              ? 0x1e293b
              : 0xffffff,
        )
      }
      leaderLabel.textContent = leader
        ? `Leader · ${leader.region} (${format(leader.revenue)})`
        : ''

      revEl.textContent = format(totalRev)
      ordEl.textContent = format(totalOrd)
      cusEl.textContent = format(totalCus)
      marEl.textContent = `${format(marginW ? marginAcc / marginW : 0)}%`

      const chMax = Math.max(1, ...[...channelTotals.values()].map((v) => v.revenue))
      mixEl.innerHTML = ''
      channels.forEach((ch, i) => {
        const vals = channelTotals.get(ch) || { revenue: 0, orders: 0 }
        const row = document.createElement('div')
        row.className = 'ccc-mix-row'
        const pct = Math.round((vals.revenue / chMax) * 100)
        row.innerHTML = `<span><i></i>${ch}</span><div class="ccc-bar"><span style="width:${pct}%;background:#${channelColors[i].getHexString()}"></span></div><span>${format(vals.revenue)}</span>`
        mixEl.appendChild(row)
      })

      const topCats = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
      catsEl.innerHTML = ''
      topCats.forEach(([cat, val], i) => {
        const chip = document.createElement('span')
        chip.className = 'ccc-chip'
        const color = categoryColors[categories.indexOf(cat)] || categoryColors[i] || new THREE.Color(accent)
        chip.innerHTML = `<b style="color:#${color.getHexString()}">${cat}</b> · ${format(val)}`
        catsEl.appendChild(chip)
      })

      // Update particles toward pads weighted by channel orders
      const orderWeights = pads.map((p) => Math.max(0.05, p.orders))
      const orderSum = orderWeights.reduce((a, b) => a + b, 0)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const meta = particleMeta[i]
        meta.t = (meta.t + meta.speed * 0.016) % 1
        const pad = pads[meta.regionIndex % pads.length]
        const share = orderWeights[meta.regionIndex % pads.length] / orderSum
        meta.speed = 0.12 + share * 0.55 + Math.random() * 0.05
        const u = meta.t
        const hx = 0
        const hz = 0
        const px = pad.group.position.x
        const pz = pad.group.position.z
        const lift = Math.sin(u * Math.PI) * (1.2 + share * 2.2)
        const x = hx + (px - hx) * u
        const z = hz + (pz - hz) * u
        const y = 0.4 + lift
        particlePos[i * 3] = x
        particlePos[i * 3 + 1] = y
        particlePos[i * 3 + 2] = z
        const col = channelColors[meta.channelIndex % channelColors.length] || new THREE.Color(accent)
        particleCol[i * 3] = col.r
        particleCol[i * 3 + 1] = col.g
        particleCol[i * 3 + 2] = col.b
      }
      particleGeo.attributes.position.needsUpdate = true
      particleGeo.attributes.color.needsUpdate = true
      particles.visible = channels.length > 0
    }

    revealTo(0)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    const pick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const objs = pads.flatMap((p) => [p.pad, ...p.towers.map((t) => t.mesh)])
      const hits = raycaster.intersectObjects(objs)
      return hits[0]
    }

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (dragging) {
        targetRotY += (event.clientX - previousX) * 0.005
        previousX = event.clientX
      }
      const hit = pick(event)
      if (hit) {
        const region = hit.object.userData.region
        const entry = pads.find((p) => p.region === region)
        tooltip.style.display = 'block'
        tooltip.style.left = `${event.clientX - rect.left}px`
        tooltip.style.top = `${event.clientY - rect.top}px`
        const topCat = [...(lerpBucket(region, progress).categories.entries())].sort(
          (a, b) => b[1] - a[1],
        )[0]
        tooltip.innerHTML = `<strong>${region}</strong>Revenue ${format(entry.revenue)}<br/>Orders ${format(entry.orders)} · Customers ${format(entry.customers)}<br/>Margin ${format(entry.margin)}%${topCat ? `<br/>Top category · ${topCat[0]}` : ''}`
      } else {
        tooltip.style.display = 'none'
      }
    }
    const onPointerDown = (event) => {
      dragging = true
      previousX = event.clientX
      renderer.domElement.setPointerCapture(event.pointerId)
      const hit = pick(event)
      if (hit) {
        const region = hit.object.userData.region
        focusRegion = focusRegion === region ? null : region
        revealTo(progress)
      }
    }
    const onPointerUp = () => {
      dragging = false
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    playBtn.addEventListener('click', () => {
      if (years.length < 2) return
      playing = !playing
      playBtn.textContent = playing ? 'Pause' : 'Play'
      if (playing && progress >= years.length - 1) revealTo(0)
    })
    scrub.addEventListener('input', () => {
      playing = false
      playBtn.textContent = 'Play'
      revealTo(Number(scrub.value) / 100)
    })
    if (years.length < 2) {
      playing = false
      playBtn.textContent = 'Play'
      playBtn.disabled = true
    }

    const resize = new ResizeObserver(() => {
      const w = stage.clientWidth
      const h = stage.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      reportHeight()
    })
    resize.observe(stage)

    let lastTs = performance.now()
    const animate = (ts) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000)
      lastTs = ts
      if (playing && years.length > 1) {
        progress += SPEED * dt
        if (progress >= years.length - 1) {
          progress = years.length - 1
          playing = false
          playBtn.textContent = 'Play'
        }
        revealTo(progress)
      } else {
        // keep particles drifting even when paused
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const meta = particleMeta[i]
          meta.t = (meta.t + meta.speed * dt) % 1
          const pad = pads[meta.regionIndex % pads.length]
          const u = meta.t
          const px = pad.group.position.x
          const pz = pad.group.position.z
          const lift = Math.sin(u * Math.PI) * 1.6
          particlePos[i * 3] = px * u
          particlePos[i * 3 + 1] = 0.4 + lift
          particlePos[i * 3 + 2] = pz * u
        }
        particleGeo.attributes.position.needsUpdate = true
      }
      floor.rotation.y += (targetRotY - floor.rotation.y) * 0.06
      rim.intensity = 1.1 + Math.sin(ts * 0.002) * 0.25
      renderer.render(scene, camera)
      for (const entry of pads) projectLabel(entry)
      frame = requestAnimationFrame(animate)
    }
    animate(performance.now())
    reportHeight()

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      scene.traverse((object) => {
        object.geometry?.dispose()
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose())
        else object.material?.dispose()
      })
      renderer.dispose()
      board.remove()
      styles.remove()
    }
  },
}
