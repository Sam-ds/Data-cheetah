/*
 * DataCheetah Three.js pack — Product Growth Race
 *
 * Bars rise year by year; lane order follows current rank so one product
 * can visibly overtake another. Uses mapped roles from rule.json settings.
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

    // year -> product -> revenue
    const byYear = new Map()
    const products = new Set()
    for (const row of payload.rows) {
      const year = String(row[timeKey] ?? '')
      const product = text(row[dimension])
      if (!year || product === '—') continue
      products.add(product)
      if (!byYear.has(year)) byYear.set(year, new Map())
      const bucket = byYear.get(year)
      bucket.set(product, (bucket.get(product) || 0) + number(row[measure]))
    }
    const years = [...byYear.keys()].sort((a, b) => Number(a) - Number(b))
    const productList = [...products].slice(0, 10)
    if (!years.length || !productList.length) {
      root.textContent = 'No year/product/measure rows to race'
      reportHeight()
      return () => {}
    }

    const maxValue = Math.max(
      1,
      ...years.flatMap((year) =>
        productList.map((product) => byYear.get(year)?.get(product) || 0),
      ),
    )

    const styles = document.createElement('style')
    styles.textContent = `
      .race-board { position: relative; max-width: 1120px; margin: 0 auto; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--card); }
      .race-head { display: flex; justify-content: space-between; gap: 16px; padding: 16px 18px 8px; }
      .race-head small { color: var(--accent); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .race-head h1 { margin: 4px 0 2px; font-size: 21px; }
      .race-head p { margin: 0; color: var(--muted); font-size: 12px; }
      .race-stats { text-align: right; }
      .race-stats strong { display: block; font-size: 20px; }
      .race-stats span { color: var(--muted); font-size: 10px; text-transform: uppercase; }
      .race-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 0 18px 12px; }
      .race-controls button { height: 32px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); padding: 0 12px; font-weight: 700; cursor: pointer; }
      .race-controls button:hover { border-color: var(--accent); }
      .race-controls input[type="range"] { flex: 1; min-width: 140px; accent-color: var(--accent); }
      .race-year { min-width: 3.5rem; font-weight: 800; font-variant-numeric: tabular-nums; }
      .race-leader { color: var(--muted); font-size: 11px; }
      .race-stage { width: 100%; height: clamp(420px, 62vh, 78vh); cursor: grab; }
      .race-stage:active { cursor: grabbing; }
      .race-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; padding: 12px; border-top: 1px solid var(--border); }
      .race-legend span { overflow: hidden; padding: 6px 8px; border-radius: 8px; background: var(--bg); color: var(--muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
      .race-legend i { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; }
      .race-tooltip { position: absolute; z-index: 3; display: none; transform: translate(12px, 12px); border: 1px solid var(--border); border-radius: 9px; background: var(--card); padding: 7px 9px; box-shadow: 0 8px 25px rgba(0,0,0,.18); pointer-events: none; font-size: 11px; }
    `
    document.head.appendChild(styles)

    const board = document.createElement('main')
    board.className = 'race-board'
    board.innerHTML = `
      <header class="race-head">
        <div>
          <small>Custom visualization.js</small>
          <h1></h1>
          <p>Play years to watch products overtake each other</p>
        </div>
        <div class="race-stats">
          <span>Year total</span>
          <strong class="race-total">0</strong>
          <div class="race-leader"></div>
        </div>
      </header>
      <div class="race-controls">
        <button type="button" class="race-play">Pause</button>
        <input class="race-scrub" type="range" min="0" max="${years.length - 1}" step="1" value="0" />
        <span class="race-year">${years[0]}</span>
      </div>
      <div class="race-stage"></div>
      <div class="race-tooltip"></div>
      <div class="race-legend"></div>
    `
    board.querySelector('h1').textContent = payload.title
    root.appendChild(board)

    const stage = board.querySelector('.race-stage')
    const legend = board.querySelector('.race-legend')
    const tooltip = board.querySelector('.race-tooltip')
    const playBtn = board.querySelector('.race-play')
    const scrub = board.querySelector('.race-scrub')
    const yearLabel = board.querySelector('.race-year')
    const totalLabel = board.querySelector('.race-total')
    const leaderLabel = board.querySelector('.race-leader')

    const dark = payload.theme === 'dark'
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(dark ? 0x0b1220 : 0xf4f7fb)
    scene.fog = new THREE.Fog(scene.background, 22, 42)

    const camera = new THREE.PerspectiveCamera(40, stage.clientWidth / stage.clientHeight, 0.1, 100)
    camera.position.set(11, 9, 18)
    camera.lookAt(0, 3, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(stage.clientWidth, stage.clientHeight)
    renderer.shadowMap.enabled = true
    stage.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.1))
    const light = new THREE.DirectionalLight(0xffffff, 2.6)
    light.position.set(8, 14, 6)
    light.castShadow = true
    scene.add(light)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 16),
      new THREE.MeshStandardMaterial({
        color: dark ? 0x111a2b : 0xffffff,
        roughness: 0.92,
      }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    scene.add(new THREE.GridHelper(20, 20, 0x64748b, 0x94a3b8))

    const bars = new THREE.Group()
    scene.add(bars)
    const spacing = 1.45
    const meshes = []
    const colors = productList.map((_, index) =>
      new THREE.Color().setHSL(0.04 + (index / Math.max(1, productList.length)) * 0.55, 0.72, 0.52),
    )

    productList.forEach((product, index) => {
      const color = colors[index]
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color.clone().multiplyScalar(0.12),
          roughness: 0.35,
          metalness: 0.08,
        }),
      )
      mesh.castShadow = true
      mesh.position.set(0, 0.5, (index - (productList.length - 1) / 2) * spacing)
      mesh.userData = {
        product,
        color,
        targetHeight: 0.25,
        displayHeight: 0.25,
        targetZ: mesh.position.z,
        displayZ: mesh.position.z,
        value: 0,
      }
      bars.add(mesh)
      meshes.push(mesh)

      const chip = document.createElement('span')
      chip.innerHTML = `<i></i>${product}`
      chip.querySelector('i').style.background = `#${color.getHexString()}`
      legend.appendChild(chip)
    })

    let yearIndex = 0
    let playing = true
    let playAccumulator = 0
    let frame = 0
    let dragging = false
    let previousX = 0
    let targetRotation = -0.18

    const valuesForYear = (index) => {
      const year = years[index]
      const bucket = byYear.get(year) || new Map()
      return productList
        .map((product) => ({
          product,
          value: bucket.get(product) || 0,
        }))
        .sort((a, b) => b.value - a.value)
    }

    const applyYear = (index) => {
      yearIndex = Math.max(0, Math.min(years.length - 1, index))
      const ranked = valuesForYear(yearIndex)
      const total = ranked.reduce((sum, item) => sum + item.value, 0)
      yearLabel.textContent = years[yearIndex]
      scrub.value = String(yearIndex)
      totalLabel.textContent = format(total)
      leaderLabel.textContent = ranked[0]
        ? `Leader · ${ranked[0].product} (${format(ranked[0].value)})`
        : ''

      ranked.forEach((item, rank) => {
        const mesh = meshes.find((entry) => entry.userData.product === item.product)
        if (!mesh) return
        mesh.userData.value = item.value
        mesh.userData.targetHeight = Math.max(0.25, (item.value / maxValue) * 7.5)
        // Rank 0 (leader) toward camera; lower ranks further back / aside
        mesh.userData.targetZ = (rank - (productList.length - 1) / 2) * spacing
      })
    }

    applyYear(0)

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (dragging) {
        targetRotation += (event.clientX - previousX) * 0.008
        previousX = event.clientX
      }
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(meshes)[0]
      if (hit) {
        tooltip.style.display = 'block'
        tooltip.style.left = `${event.clientX - rect.left}px`
        tooltip.style.top = `${event.clientY - rect.top}px`
        tooltip.textContent = `${hit.object.userData.product}: ${format(hit.object.userData.value)}`
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
      if (playing && yearIndex >= years.length - 1) {
        applyYear(0)
        playAccumulator = 0
      }
    })
    scrub.addEventListener('input', () => {
      playing = false
      playBtn.textContent = 'Play'
      applyYear(Number(scrub.value))
    })

    const resize = new ResizeObserver(() => {
      const width = stage.clientWidth
      const height = stage.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      reportHeight()
    })
    resize.observe(stage)

    const animate = () => {
      if (playing) {
        playAccumulator += 1
        if (playAccumulator >= 90) {
          playAccumulator = 0
          if (yearIndex >= years.length - 1) {
            playing = false
            playBtn.textContent = 'Play'
          } else {
            applyYear(yearIndex + 1)
          }
        }
      }

      for (const mesh of meshes) {
        const data = mesh.userData
        data.displayHeight += (data.targetHeight - data.displayHeight) * 0.08
        data.displayZ += (data.targetZ - data.displayZ) * 0.08
        mesh.scale.y = data.displayHeight
        mesh.position.y = data.displayHeight / 2
        mesh.position.z = data.displayZ
      }

      bars.rotation.y += (targetRotation - bars.rotation.y) * 0.07
      renderer.render(scene, camera)
      frame = requestAnimationFrame(animate)
    }
    animate()
    reportHeight()

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      scene.traverse((object) => {
        object.geometry?.dispose()
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
        else object.material?.dispose()
      })
      renderer.dispose()
      board.remove()
      styles.remove()
    }
  },
}
