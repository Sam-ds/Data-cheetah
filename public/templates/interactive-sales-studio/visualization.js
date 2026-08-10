/*
 * DataCheetah Three.js pack entry.
 *
 * The sandbox provides THREE, mapped data, a root element, and reportHeight().
 * Return a cleanup function so animation frames and WebGL resources are freed.
 */
window.DataCheetahVisualization = {
  mount({ THREE, payload, root, reportHeight }) {
    const dimension = String(payload.settings?.dimension || payload.columns[0])
    const measure = String(payload.settings?.measure || payload.columns[1])
    const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
    const format = (value) => new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)

    // Aggregate mapped rows using logical role names from rule.json.
    const totals = new Map()
    for (const row of payload.rows) {
      const label = String(row[dimension] ?? 'Unknown')
      totals.set(label, (totals.get(label) || 0) + number(row[measure]))
    }
    const data = [...totals.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
    const maximum = Math.max(1, ...data.map((item) => item.value))

    const styles = document.createElement('style')
    styles.textContent = `
      .three-board { position: relative; max-width: 1120px; margin: 0 auto; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--card); }
      .three-head { position: absolute; z-index: 2; inset: 0 0 auto; display: flex; justify-content: space-between; gap: 16px; padding: 18px 20px; pointer-events: none; }
      .three-head small { color: var(--accent); font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
      .three-head h1 { margin: 5px 0 3px; font-size: 22px; }
      .three-head p { margin: 0; color: var(--muted); }
      .three-total { text-align: right; }
      .three-total strong { display: block; font-size: 22px; }
      .three-stage { width: 100%; height: clamp(420px, 62vh, 78vh); cursor: grab; }
      .three-stage:active { cursor: grabbing; }
      .three-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px; padding: 12px; border-top: 1px solid var(--border); }
      .three-legend span { overflow: hidden; padding: 6px 8px; border-radius: 8px; background: var(--bg); color: var(--muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
      .three-legend i { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; }
      .three-tooltip { position: absolute; z-index: 3; display: none; transform: translate(12px, 12px); border: 1px solid var(--border); border-radius: 9px; background: var(--card); padding: 7px 9px; box-shadow: 0 8px 25px rgba(0,0,0,.18); pointer-events: none; }
    `
    document.head.appendChild(styles)

    const board = document.createElement('main')
    board.className = 'three-board'
    board.innerHTML = `
      <header class="three-head">
        <div>
          <small>Custom visualization.js</small>
          <h1></h1>
          <p>Drag to rotate · Hover a bar for details</p>
        </div>
        <div class="three-total"><span>Total ${measure}</span><strong></strong></div>
      </header>
      <div class="three-stage"></div>
      <div class="three-tooltip"></div>
      <div class="three-legend"></div>
    `
    board.querySelector('h1').textContent = payload.title
    board.querySelector('.three-total strong').textContent =
      format(data.reduce((sum, item) => sum + item.value, 0))
    root.appendChild(board)

    const stage = board.querySelector('.three-stage')
    const legend = board.querySelector('.three-legend')
    const tooltip = board.querySelector('.three-tooltip')
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(payload.theme === 'dark' ? 0x0b1220 : 0xf8fafc)
    scene.fog = new THREE.Fog(scene.background, 18, 36)

    const camera = new THREE.PerspectiveCamera(42, stage.clientWidth / stage.clientHeight, 0.1, 100)
    camera.position.set(10, 10, 16)
    camera.lookAt(0, 3, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(stage.clientWidth, stage.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    stage.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.2))
    const light = new THREE.DirectionalLight(0xffffff, 3)
    light.position.set(6, 12, 8)
    light.castShadow = true
    scene.add(light)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 18),
      new THREE.MeshStandardMaterial({
        color: payload.theme === 'dark' ? 0x111a2b : 0xffffff,
        roughness: 0.9,
      }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    scene.add(new THREE.GridHelper(18, 18, 0x64748b, 0x94a3b8))

    const bars = new THREE.Group()
    const meshes = []
    const spacing = 1.35
    const start = -((data.length - 1) * spacing) / 2
    data.forEach((item, index) => {
      const height = Math.max(0.25, item.value / maximum * 7)
      const color = new THREE.Color().setHSL(0.08 + index / Math.max(1, data.length) * 0.52, 0.72, 0.54)
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, height, 0.9),
        new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.08 }),
      )
      mesh.position.set(start + index * spacing, height / 2, 0)
      mesh.castShadow = true
      mesh.userData = item
      bars.add(mesh)
      meshes.push(mesh)

      const chip = document.createElement('span')
      chip.innerHTML = `<i></i>${item.label}: ${format(item.value)}`
      chip.querySelector('i').style.background = `#${color.getHexString()}`
      legend.appendChild(chip)
    })
    scene.add(bars)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let dragging = false
    let previousX = 0
    let targetRotation = -0.12
    let frame = 0

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (dragging) {
        targetRotation += (event.clientX - previousX) * 0.008
        previousX = event.clientX
      }
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(meshes)[0]
      if (hit) {
        tooltip.style.display = 'block'
        tooltip.style.left = `${event.clientX - rect.left}px`
        tooltip.style.top = `${event.clientY - rect.top}px`
        tooltip.textContent = `${hit.object.userData.label}: ${format(hit.object.userData.value)}`
      } else {
        tooltip.style.display = 'none'
      }
    }
    const onPointerDown = (event) => {
      dragging = true
      previousX = event.clientX
      renderer.domElement.setPointerCapture(event.pointerId)
    }
    const onPointerUp = () => { dragging = false }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

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
