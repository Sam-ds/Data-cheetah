/*
 * DataCheetah Three.js pack — Product Line Race
 *
 * Each product is a racing line with a named tip. Playback interpolates
 * between years so steeper growers climb faster (Y speed differs even though
 * the shared year playhead advances together on X).
 */
window.DataCheetahVisualization = {
  mount({ THREE, payload, root, reportHeight }) {
    const timeKey = String(payload.settings?.time || 'year')
    const dimension = String(payload.settings?.dimension || 'product')
    const measure = String(payload.settings?.measure || 'revenue')
    const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
    const format = (value) =>
      new Intl.NumberFormat(undefined, {
        notation: Math.abs(value) >= 10000 ? 'compact' : 'standard',
        maximumFractionDigits: 1,
      }).format(value)
    const text = (value) => (value == null ? '—' : String(value))

    const byYear = new Map()
    const products = new Set()
    for (const row of payload.rows) {
      const year = String(row[timeKey] ?? '')
      const product = text(row[dimension])
      if (!year || product === '—') continue
      products.add(product)
      if (!byYear.has(year)) byYear.set(year, new Map())
      byYear.get(year).set(product, (byYear.get(year).get(product) || 0) + number(row[measure]))
    }
    const years = [...byYear.keys()].sort((a, b) => Number(a) - Number(b))
    const productList = [...products].slice(0, 8)
    if (years.length < 2 || !productList.length) {
      root.textContent = 'Need at least two years of product/measure rows for a line race'
      reportHeight()
      return () => {}
    }

    const maxValue = Math.max(
      1,
      ...years.flatMap((year) => productList.map((p) => byYear.get(year)?.get(p) || 0)),
    )

    const styles = document.createElement('style')
    styles.textContent = `
      .line-race { position: relative; max-width: 1120px; margin: 0 auto; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--card); }
      .line-race-head { display: flex; justify-content: space-between; gap: 16px; padding: 16px 18px 8px; }
      .line-race-head small { color: var(--accent); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .line-race-head h1 { margin: 4px 0 2px; font-size: 21px; }
      .line-race-head p { margin: 0; color: var(--muted); font-size: 12px; }
      .line-race-stats { text-align: right; }
      .line-race-stats strong { display: block; font-size: 20px; }
      .line-race-stats span { color: var(--muted); font-size: 10px; text-transform: uppercase; }
      .line-race-leader { color: var(--muted); font-size: 11px; margin-top: 4px; }
      .line-race-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 0 18px 12px; }
      .line-race-controls button { height: 32px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); padding: 0 12px; font-weight: 700; cursor: pointer; }
      .line-race-controls input[type="range"] { flex: 1; min-width: 140px; accent-color: var(--accent); }
      .line-race-year { min-width: 3.5rem; font-weight: 800; font-variant-numeric: tabular-nums; }
      .line-race-stage { width: 100%; height: clamp(420px, 62vh, 78vh); cursor: grab; }
      .line-race-stage:active { cursor: grabbing; }
      .line-race-labels { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
      .line-race-label {
        position: absolute; left: 0; top: 0; z-index: 2;
        display: flex; align-items: center; gap: 5px;
        max-width: 11rem; padding: 3px 8px 3px 5px;
        border: 1px solid color-mix(in srgb, var(--chip, #888) 45%, var(--border));
        border-radius: 999px;
        background: color-mix(in srgb, var(--card) 88%, transparent);
        box-shadow: 0 4px 14px rgba(0,0,0,.12);
        color: var(--text); font-size: 10px; font-weight: 750;
        white-space: nowrap; transform: translate(10px, -50%);
        backdrop-filter: blur(6px);
      }
      .line-race-label.is-leader {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 6px 16px rgba(0,0,0,.16);
      }
      .line-race-label i {
        display: inline-block; width: 7px; height: 7px; border-radius: 50%;
        background: var(--chip, #888); flex-shrink: 0;
      }
      .line-race-label em { color: var(--muted); font-style: normal; font-weight: 650; margin-left: 2px; }
      .line-race-label b { overflow: hidden; text-overflow: ellipsis; }
      .line-race-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; padding: 12px; border-top: 1px solid var(--border); }
      .line-race-legend span { overflow: hidden; padding: 6px 8px; border-radius: 8px; background: var(--bg); color: var(--muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
      .line-race-legend i { display: inline-block; width: 10px; height: 3px; margin-right: 6px; border-radius: 2px; vertical-align: middle; }
      .line-race-tooltip { position: absolute; z-index: 3; display: none; transform: translate(12px, 12px); border: 1px solid var(--border); border-radius: 9px; background: var(--card); padding: 7px 9px; box-shadow: 0 8px 25px rgba(0,0,0,.18); pointer-events: none; font-size: 11px; }
    `
    document.head.appendChild(styles)

    const board = document.createElement('main')
    board.className = 'line-race'
    board.innerHTML = `
      <header class="line-race-head">
        <div>
          <small>Custom visualization.js</small>
          <h1></h1>
          <p>Named tips · steeper growth climbs faster between years</p>
        </div>
        <div class="line-race-stats">
          <span>Year total</span>
          <strong class="line-race-total">0</strong>
          <div class="line-race-leader"></div>
        </div>
      </header>
      <div class="line-race-controls">
        <button type="button" class="line-race-play">Pause</button>
        <input class="line-race-scrub" type="range" min="0" max="${(years.length - 1) * 100}" step="1" value="0" />
        <span class="line-race-year">${years[0]}</span>
      </div>
      <div class="line-race-stage">
        <div class="line-race-labels" aria-hidden="true"></div>
      </div>
      <div class="line-race-tooltip"></div>
      <div class="line-race-legend"></div>
    `
    board.querySelector('h1').textContent = payload.title
    root.appendChild(board)

    const stage = board.querySelector('.line-race-stage')
    const labelsLayer = board.querySelector('.line-race-labels')
    const legend = board.querySelector('.line-race-legend')
    const tooltip = board.querySelector('.line-race-tooltip')
    const playBtn = board.querySelector('.line-race-play')
    const scrub = board.querySelector('.line-race-scrub')
    const yearLabel = board.querySelector('.line-race-year')
    const totalLabel = board.querySelector('.line-race-total')
    const leaderLabel = board.querySelector('.line-race-leader')

    const dark = payload.theme === 'dark'
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(dark ? 0x0b1220 : 0xf4f7fb)
    scene.fog = new THREE.Fog(scene.background, 28, 55)

    const camera = new THREE.PerspectiveCamera(38, stage.clientWidth / stage.clientHeight, 0.1, 100)
    camera.position.set(0, 8, 18)
    camera.lookAt(0, 3, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(stage.clientWidth, stage.clientHeight)
    stage.insertBefore(renderer.domElement, labelsLayer)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.8))
    const light = new THREE.DirectionalLight(0xffffff, 2.2)
    light.position.set(4, 12, 8)
    scene.add(light)

    const chart = new THREE.Group()
    scene.add(chart)

    const width = 14
    const height = 7
    const x0 = -width / 2
    const y0 = 0.4

    const axisMat = new THREE.LineBasicMaterial({ color: dark ? 0x64748b : 0x94a3b8 })
    const axisPoints = [
      new THREE.Vector3(x0, y0, 0),
      new THREE.Vector3(x0 + width, y0, 0),
      new THREE.Vector3(x0, y0, 0),
      new THREE.Vector3(x0, y0 + height, 0),
    ]
    chart.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(axisPoints), axisMat))

    years.forEach((_, index) => {
      const x = x0 + (index / Math.max(1, years.length - 1)) * width
      chart.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, y0, 0),
            new THREE.Vector3(x, y0 + height, 0),
          ]),
          new THREE.LineBasicMaterial({ color: dark ? 0x1e293b : 0xe2e8f0 }),
        ),
      )
    })

    const series = []
    productList.forEach((product, index) => {
      const color = new THREE.Color().setHSL(
        0.02 + (index / Math.max(1, productList.length)) * 0.58,
        0.75,
        0.52,
      )
      const values = years.map((year) => byYear.get(year)?.get(product) || 0)
      const fullPoints = values.map(
        (value, yearIndex) =>
          new THREE.Vector3(
            x0 + (yearIndex / Math.max(1, years.length - 1)) * width,
            y0 + (value / maxValue) * height,
            0.02 * index,
          ),
      )

      const positions = new Float32Array((years.length + 1) * 3)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setDrawRange(0, 0)
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, linewidth: 2 }))
      chart.add(line)

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 16, 16),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color.clone().multiplyScalar(0.35),
          roughness: 0.35,
        }),
      )
      marker.visible = false
      chart.add(marker)

      const label = document.createElement('div')
      label.className = 'line-race-label'
      label.style.setProperty('--chip', `#${color.getHexString()}`)
      label.innerHTML = `<i></i><b></b><em></em>`
      label.querySelector('b').textContent = product
      labelsLayer.appendChild(label)

      series.push({ product, color, values, fullPoints, line, marker, label, value: 0 })

      const chip = document.createElement('span')
      chip.innerHTML = `<i></i>${product}`
      chip.querySelector('i').style.background = `#${color.getHexString()}`
      legend.appendChild(chip)
    })

    const playhead = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, y0, 0.2),
        new THREE.Vector3(0, y0 + height, 0.2),
      ]),
      new THREE.LineBasicMaterial({ color: 0xf2a01f }),
    )
    chart.add(playhead)

    let progress = 0
    let playing = true
    let frame = 0
    let dragging = false
    let previousX = 0
    let targetRotation = 0.12
    const tmp = new THREE.Vector3()
    const SPEED = 0.22 // years per second — continuous, not lockstep jumps

    const valueAt = (entry, t) => {
      const i0 = Math.floor(t)
      const i1 = Math.min(i0 + 1, years.length - 1)
      const f = t - i0
      return entry.values[i0] + (entry.values[i1] - entry.values[i0]) * f
    }

    const pointAt = (entry, t, out = tmp) => {
      const i0 = Math.floor(t)
      const i1 = Math.min(i0 + 1, years.length - 1)
      const f = t - i0
      const a = entry.fullPoints[i0]
      const b = entry.fullPoints[i1]
      out.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f)
      return out
    }

    const projectLabel = (entry) => {
      const world = entry.marker.position.clone()
      chart.localToWorld(world)
      world.project(camera)
      const x = (world.x * 0.5 + 0.5) * stage.clientWidth
      const y = (-world.y * 0.5 + 0.5) * stage.clientHeight
      const onScreen = world.z > -1 && world.z < 1
      entry.label.style.display = onScreen ? 'flex' : 'none'
      entry.label.style.transform = `translate(${x + 12}px, ${y}px) translateY(-50%)`
    }

    const revealTo = (t) => {
      progress = Math.max(0, Math.min(years.length - 1, t))
      const i0 = Math.floor(progress)
      const frac = progress - i0
      const displayYear =
        frac < 0.5 || i0 >= years.length - 1 ? years[i0] : years[Math.min(i0 + 1, years.length - 1)]
      yearLabel.textContent = displayYear
      scrub.value = String(Math.round(progress * 100))

      const ranked = series
        .map((entry) => ({ product: entry.product, value: valueAt(entry, progress) }))
        .sort((a, b) => b.value - a.value)
      const total = ranked.reduce((sum, item) => sum + item.value, 0)
      totalLabel.textContent = format(total)
      leaderLabel.textContent = ranked[0]
        ? `Leader · ${ranked[0].product} (${format(ranked[0].value)})`
        : ''

      const playX = x0 + (progress / Math.max(1, years.length - 1)) * width
      playhead.geometry.setFromPoints([
        new THREE.Vector3(playX, y0, 0.25),
        new THREE.Vector3(playX, y0 + height, 0.25),
      ])

      const leaderName = ranked[0]?.product
      for (const entry of series) {
        const attr = entry.line.geometry.getAttribute('position')
        for (let i = 0; i <= i0; i++) {
          const point = entry.fullPoints[i]
          attr.setXYZ(i, point.x, point.y, point.z)
        }
        let drawCount = i0 + 1
        if (frac > 0.001 && i0 < years.length - 1) {
          pointAt(entry, progress, tmp)
          attr.setXYZ(i0 + 1, tmp.x, tmp.y, tmp.z)
          drawCount = i0 + 2
        }
        attr.needsUpdate = true
        entry.line.geometry.setDrawRange(0, drawCount)
        entry.line.geometry.computeBoundingSphere()

        entry.value = valueAt(entry, progress)
        pointAt(entry, progress, tmp)
        entry.marker.visible = true
        entry.marker.position.copy(tmp)
        entry.marker.position.z += 0.05
        const scale = 0.85 + (entry.value / maxValue) * 1.35
        entry.marker.scale.setScalar(scale)

        entry.label.classList.toggle('is-leader', entry.product === leaderName)
        entry.label.querySelector('em').textContent = format(entry.value)
      }
    }

    revealTo(0)

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (dragging) {
        targetRotation += (event.clientX - previousX) * 0.006
        previousX = event.clientX
      }
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(series.map((entry) => entry.marker))
      if (hits[0]) {
        const entry = series.find((item) => item.marker === hits[0].object)
        tooltip.style.display = 'block'
        tooltip.style.left = `${event.clientX - rect.left}px`
        tooltip.style.top = `${event.clientY - rect.top}px`
        tooltip.textContent = `${entry.product}: ${format(entry.value)}`
      } else {
        tooltip.style.display = 'none'
      }
    }
    const onPointerDown = (event) => {
      dragging = true
      previousX = event.clientX
      renderer.domElement.setPointerCapture(event.pointerId)
    }
    const onPointerUp = () => {
      dragging = false
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    playBtn.addEventListener('click', () => {
      playing = !playing
      playBtn.textContent = playing ? 'Pause' : 'Play'
      if (playing && progress >= years.length - 1) {
        revealTo(0)
      }
    })
    scrub.addEventListener('input', () => {
      playing = false
      playBtn.textContent = 'Play'
      revealTo(Number(scrub.value) / 100)
    })

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
      if (playing) {
        progress += SPEED * dt
        if (progress >= years.length - 1) {
          progress = years.length - 1
          playing = false
          playBtn.textContent = 'Play'
        }
        revealTo(progress)
      }
      chart.rotation.y += (targetRotation - chart.rotation.y) * 0.08
      renderer.render(scene, camera)
      for (const entry of series) projectLabel(entry)
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
