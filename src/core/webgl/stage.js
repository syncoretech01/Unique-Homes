/* ============================================================================
   WEBGL STAGE
   One WebGLRenderer, one fixed full-viewport canvas, many scenes.

   Each "slot" binds a THREE.Scene + Camera to a DOM element. Every frame the
   stage reads that element's rect and renders the scene into exactly that
   rectangle using the scissor test. This is how the site runs six independent
   3D scenes at 60fps in a single GL context, driven by the same GSAP ticker
   that drives Lenis — so 3D and scroll can never desync.

   Usage inside a section:

     import { stage } from '../../core/webgl/stage.js'
     const slot = stage.createSlot({
       el: myDiv,
       setup({ scene, camera, slot }) { ... build the scene ... },
       update({ dt, elapsed, slot }) { ... per-frame ... },
       resize({ width, height, slot }) { ... },
     })
   ========================================================================== */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { gsap } from '../motion.js'
import { deviceTier, clamp, prefersReducedMotion } from '../../lib/utils.js'

const MARGIN = 220 // px of off-screen tolerance before a slot stops rendering

class Stage {
  constructor() {
    this.slots = []
    this.ready = false
    this.paused = false
    this.canvas = null
    this.renderer = null
    this.env = null
    this.tier = 'high'
    this.width = 0
    this.height = 0
    this.pointer = new THREE.Vector2(0, 0)
    this._last = 0
    this._elapsed = 0
    this._raf = this._raf.bind(this)
    this._onResize = this._onResize.bind(this)
    this._onPointer = this._onPointer.bind(this)
  }

  /* ------------------------------------------------------------- LIFECYCLE */

  init() {
    if (this.ready) return this
    this.tier = deviceTier()

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'gl-stage'
    this.canvas.setAttribute('aria-hidden', 'true')
    document.body.appendChild(this.canvas)

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: this.tier === 'high',
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      })
    } catch (err) {
      console.warn('[stage] WebGL unavailable — 3D layers disabled.', err)
      document.documentElement.classList.add('no-webgl')
      this.canvas.remove()
      return this
    }

    this.renderer = renderer
    renderer.setPixelRatio(this._dpr())
    renderer.setClearColor(0x000000, 0)
    renderer.autoClear = false
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.06
    renderer.shadowMap.enabled = this.tier !== 'low'
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this._onResize()
    window.addEventListener('resize', this._onResize, { passive: true })
    window.addEventListener('pointermove', this._onPointer, { passive: true })
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden
      if (!this.paused) this._last = performance.now()
    })

    // Share the GSAP clock: added after Lenis' ticker callback, so the DOM
    // scroll position is already updated when slots read their rects.
    gsap.ticker.add(this._raf)

    this.ready = true
    document.documentElement.classList.add('has-webgl')
    return this
  }

  _dpr() {
    const cap = this.tier === 'low' ? 1.25 : this.tier === 'mid' ? 1.6 : 2
    return Math.min(window.devicePixelRatio || 1, cap)
  }

  /**
   * Shared image-based lighting, generated in-engine (no HDRI asset needed).
   * Built on first use rather than at init, so pages with no 3D never pay for
   * it — the PMREM pass is one of the costlier things we do at startup.
   */
  _ensureEnv() {
    if (this.env || !this.renderer) return this.env
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    pmrem.compileEquirectangularShader()
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    return this.env
  }

  destroy() {
    gsap.ticker.remove(this._raf)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('pointermove', this._onPointer)
    this.slots.forEach((s) => this.removeSlot(s))
    this.renderer?.dispose()
    this.canvas?.remove()
    this.ready = false
  }

  /* ----------------------------------------------------------------- SLOTS */

  /**
   * @param {object} cfg
   * @param {HTMLElement} cfg.el            DOM element the scene is drawn into
   * @param {(ctx) => void} [cfg.setup]     build the scene (called once)
   * @param {(ctx) => void} [cfg.update]    per frame, only while visible
   * @param {(ctx) => void} [cfg.resize]    on slot resize
   * @param {number} [cfg.fov=38]
   * @param {boolean} [cfg.ortho=false]
   * @param {number} [cfg.near=0.1]
   * @param {number} [cfg.far=200]
   * @param {boolean} [cfg.alwaysRender=false] render even when off-screen
   * @returns {object|null} slot handle
   */
  createSlot(cfg) {
    if (!this.ready) this.init()
    if (!this.renderer || !cfg?.el) return null

    const env = this._ensureEnv()
    const scene = new THREE.Scene()
    scene.environment = env

    const camera = cfg.ortho
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, cfg.near ?? -100, cfg.far ?? 200)
      : new THREE.PerspectiveCamera(cfg.fov ?? 38, 1, cfg.near ?? 0.1, cfg.far ?? 200)
    camera.position.set(0, 0, 6)

    const slot = {
      el: cfg.el,
      scene,
      camera,
      cfg,
      stage: this,
      renderer: this.renderer,
      env,
      tier: this.tier,
      visible: false,
      hovered: false,
      rect: { top: 0, left: 0, width: 1, height: 1, bottom: 0 },
      width: 1,
      height: 1,
      /** 0 → element's top hits viewport bottom, 1 → element's bottom leaves top */
      progress: 0,
      /** -1 → element centred below viewport, 0 centred, 1 above */
      centerOffset: 0,
      /** pointer in the element's own normalised space, -1..1 */
      pointer: new THREE.Vector2(0, 0),
      pointerSmooth: new THREE.Vector2(0, 0),
      dispose: () => this.removeSlot(slot),
    }

    slot.el.addEventListener('pointerenter', () => (slot.hovered = true))
    slot.el.addEventListener('pointerleave', () => {
      slot.hovered = false
      slot.pointer.set(0, 0)
    })

    this._measure(slot)
    cfg.setup?.({ scene, camera, slot, renderer: this.renderer, env, THREE })
    this._resizeSlot(slot)

    this.slots.push(slot)
    return slot
  }

  removeSlot(slot) {
    const i = this.slots.indexOf(slot)
    if (i > -1) this.slots.splice(i, 1)
    disposeScene(slot.scene)
  }

  /* ------------------------------------------------------------- INTERNALS */

  _onResize() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    if (!this.renderer) return
    this.renderer.setPixelRatio(this._dpr())
    this.renderer.setSize(this.width, this.height, false)
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    this.slots.forEach((slot) => {
      this._measure(slot)
      this._resizeSlot(slot)
    })
  }

  _onPointer(e) {
    this.pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    )
    for (const slot of this.slots) {
      if (!slot.visible) continue
      const r = slot.rect
      slot.pointer.set(
        clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
        clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1)
      )
    }
  }

  _measure(slot) {
    const r = slot.el.getBoundingClientRect()
    slot.rect = { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom }
    const vh = this.height || window.innerHeight
    slot.visible = r.bottom > -MARGIN && r.top < vh + MARGIN && r.width > 0 && r.height > 0
    slot.progress = clamp((vh - r.top) / (vh + r.height), 0, 1)
    slot.centerOffset = clamp((vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2), -1, 1)
  }

  _resizeSlot(slot) {
    const w = Math.max(1, slot.rect.width)
    const h = Math.max(1, slot.rect.height)
    if (w === slot.width && h === slot.height) return
    slot.width = w
    slot.height = h
    if (slot.camera.isPerspectiveCamera) {
      slot.camera.aspect = w / h
    } else {
      const s = slot.cfg.orthoSize ?? 1
      const aspect = w / h
      slot.camera.left = -s * aspect
      slot.camera.right = s * aspect
      slot.camera.top = s
      slot.camera.bottom = -s
    }
    slot.camera.updateProjectionMatrix()
    slot.cfg.resize?.({
      width: w,
      height: h,
      slot,
      aspect: w / h,
      scene: slot.scene,
      camera: slot.camera,
      renderer: this.renderer,
    })
  }

  _raf() {
    if (this.paused || !this.renderer || !this.slots.length) return

    const now = performance.now()
    if (!this._last) this._last = now
    const dt = Math.min((now - this._last) / 1000, 1 / 30)
    this._last = now
    this._elapsed += dt
    const elapsed = this._elapsed
    const renderer = this.renderer

    renderer.setScissorTest(false)
    renderer.clear(true, true, false)
    renderer.setScissorTest(true)

    for (const slot of this.slots) {
      this._measure(slot)
      if (!slot.visible && !slot.cfg.alwaysRender) continue
      this._resizeSlot(slot)

      const r = slot.rect
      // Smooth the per-slot pointer so 3D hover never feels twitchy.
      slot.pointerSmooth.x += (slot.pointer.x - slot.pointerSmooth.x) * 0.075
      slot.pointerSmooth.y += (slot.pointer.y - slot.pointerSmooth.y) * 0.075

      slot.cfg.update?.({ dt, elapsed, slot, scene: slot.scene, camera: slot.camera })

      const bottom = this.height - r.bottom
      renderer.setViewport(r.left, bottom, r.width, r.height)
      renderer.setScissor(r.left, bottom, r.width, r.height)
      renderer.clearDepth()
      renderer.render(slot.scene, slot.camera)
    }

    renderer.setScissorTest(false)
  }
}

/* ---------------------------------------------------------------- HELPERS */

export function disposeScene(root) {
  root?.traverse?.((obj) => {
    if (obj.geometry) obj.geometry.dispose()
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
    for (const m of mats) {
      for (const key of Object.keys(m)) {
        const val = m[key]
        if (val && val.isTexture) val.dispose()
      }
      m.dispose()
    }
  })
}

/** Distance a perspective camera must sit at to fit `height` world units. */
export function fitDistance(camera, height) {
  return height / 2 / Math.tan((camera.fov * Math.PI) / 360)
}

export const stage = new Stage()
export { THREE }
