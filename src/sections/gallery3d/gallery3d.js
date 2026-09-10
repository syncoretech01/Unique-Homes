/* ============================================================================
   GALLERY3D — a true 3D carousel of visualisation work.

   Six projects are painted into 2D canvases (a generated architectural
   composition per project, deterministic from its plate seed), uploaded as
   CanvasTextures and hung on a cylinder inside a shared-renderer WebGL slot.
   A small chipboard study model floats in front of the active card so the
   ring reads with real depth and parallax.

   Input model — everything funnels through ONE number: the x translation of
   an off-DOM proxy element.

       proxy.x  ──×  radPerPx ──▶  ring.rotation.y      (what you see)
       proxy.x  ──÷  pxPerCard ──▶ active index         (what you read)

   Draggable + InertiaPlugin throw and snap that proxy; the wheel handler,
   the prev/next buttons, the dots, the arrow keys and autoplay all tween the
   same property, so no two input paths can ever disagree about the state.
   ========================================================================== */
import './gallery3d.css'
import { gsap, Draggable, EASE, DUR, splitText } from '../../core/motion.js'
import { qs, qsa, clamp, damp, mulberry32, pad } from '../../lib/utils.js'
import { plateHTML } from '../../lib/drawings.js'
import { stage, THREE, fitDistance } from '../../core/webgl/stage.js'
import { lightingRig, plasterMaterial, edgeOverlay, roundedBox, PAL } from '../../core/webgl/materials.js'
import { buildMassing } from '../../core/webgl/models.js'
import { projects } from '../../data/projects.js'

/* ------------------------------------------------------------- CONSTANTS */

const SLUG = 'gallery3d'
const COUNT_MAX = 6
const SERVICE = '3D Visualisation'

const CARD_W = 3.2 // world units
const CARD_H = 2.0 // 8 : 5, matching the painted canvas
const FOV = 32

const IDLE_MS = 4000 // inactivity before autoplay resumes
const AUTO_MS = 4600 // gap between autoplay steps

const TEX = { high: [1024, 640], mid: [832, 520], low: [640, 400] }

/* ---------------------------------------------------------------- COLOUR */

function rgbOf(hex) {
  const s = String(hex || '#000').replace('#', '')
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6)
  const n = parseInt(full, 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(hex, a) {
  const [r, g, b] = rgbOf(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function mixHex(a, b, t) {
  const x = rgbOf(a)
  const y = rgbOf(b)
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))

/* -------------------------------------------------------- CANVAS DRAWING */

const MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, Consolas, monospace"
const monoFont = (px, weight = 500) => `${weight} ${Math.max(1, Math.round(px))}px ${MONO}`

/** Draw monospaced text with real letter-spacing, char by char. */
function tracked(g, text, x, y, track) {
  let cx = x
  for (const ch of String(text)) {
    g.fillText(ch, cx, y)
    cx += g.measureText(ch).width + track
  }
  return cx - x - track
}

function trackedWidth(g, text, track) {
  let w = 0
  for (const ch of String(text)) w += g.measureText(ch).width + track
  return Math.max(0, w - track)
}

const SHEET_NO = {
  plan: 'A-1', section: 'A-2', elevation: 'A-3', axon: 'A-4',
  site: 'C-1', framing: 'S-2', detail: 'A-5', contour: 'C-2', grid: 'A-0',
}

/**
 * Paint one project's card artwork: a warm graded field, a drawn elevation
 * study on a setting-out grid, a dimension string, and a mono title block.
 * Deterministic — the same project always paints the same picture.
 */
function paintCard(cv, project, ordinal, total) {
  const g = cv.getContext('2d')
  if (!g) return
  const W = cv.width
  const H = cv.height
  const p = project.plate || {}
  const A = p.a || '#F1ECE2'
  const B = p.b || '#DBD1BE'
  const INK = p.ink || '#27415A'
  const ACC = p.accent || '#AE4E2A'
  const rnd = mulberry32(Math.floor(p.seed || 1) * 101 + 17)

  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, W, H)
  g.lineCap = 'butt'
  g.lineJoin = 'miter'
  g.textBaseline = 'alphabetic'

  const hair = Math.max(1, W * 0.0011)

  /* ------------------------------------------------------------- 1 field */
  const field = g.createLinearGradient(0, 0, W * 0.82, H)
  field.addColorStop(0, A)
  field.addColorStop(0.52, mixHex(A, B, 0.42))
  field.addColorStop(1, B)
  g.fillStyle = field
  g.fillRect(0, 0, W, H)

  const glow = g.createRadialGradient(W * 0.30, H * 0.10, 0, W * 0.30, H * 0.10, W * 0.78)
  glow.addColorStop(0, 'rgba(255,255,255,0.46)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, W, H)

  const M = Math.round(Math.min(W, H) * 0.075)
  const bx = { x0: M, y0: M, x1: W - M, y1: H - M }
  bx.w = bx.x1 - bx.x0
  bx.h = bx.y1 - bx.y0

  /* ----------------------------------------------------- 2 setting out */
  const mod = bx.w / 24
  g.lineWidth = hair
  g.strokeStyle = rgba(INK, 0.075)
  g.beginPath()
  for (let x = bx.x0; x <= bx.x1 + 0.5; x += mod) {
    g.moveTo(Math.round(x) + 0.5, bx.y0)
    g.lineTo(Math.round(x) + 0.5, bx.y1)
  }
  for (let y = bx.y0; y <= bx.y1 + 0.5; y += mod) {
    g.moveTo(bx.x0, Math.round(y) + 0.5)
    g.lineTo(bx.x1, Math.round(y) + 0.5)
  }
  g.stroke()

  g.strokeStyle = rgba(INK, 0.14)
  g.beginPath()
  for (let x = bx.x0, i = 0; x <= bx.x1 + 0.5; x += mod, i++) {
    if (i % 4) continue
    g.moveTo(Math.round(x) + 0.5, bx.y0)
    g.lineTo(Math.round(x) + 0.5, bx.y1)
  }
  g.stroke()

  /* Ghosted index, drawn under the linework like a sheet watermark. */
  g.font = monoFont(H * 0.155, 600)
  g.fillStyle = rgba(INK, 0.1)
  tracked(g, pad(ordinal), bx.x0, bx.y0 + H * 0.135, H * 0.006)

  /* -------------------------------------------------------- 3 the massing */
  const gy = Math.round(bx.y0 + bx.h * 0.72)
  const bandX = bx.x0 + bx.w * 0.055
  const bandW = bx.w * 0.68
  const bays = 4 + Math.floor(rnd() * 3)

  const shares = []
  let total0 = 0
  for (let i = 0; i < bays; i++) {
    const v = 0.62 + rnd()
    shares.push(v)
    total0 += v
  }

  const tall = Math.floor(rnd() * bays)
  const heights = shares.map((_, i) =>
    bx.h * (i === tall ? 0.47 + rnd() * 0.11 : 0.15 + rnd() * 0.30)
  )

  const cut = Math.floor(rnd() * bays)
  const bayRects = []
  let cx = bandX
  for (let i = 0; i < bays; i++) {
    const w = (bandW * shares[i]) / total0
    const h = heights[i]
    const r = { x: Math.round(cx), y: Math.round(gy - h), w: Math.round(w), h: Math.round(h) }
    bayRects.push(r)
    cx += w

    g.fillStyle = rgba(INK, 0.04 + (i % 3) * 0.022)
    g.fillRect(r.x, r.y, r.w, r.h)

    g.lineWidth = hair * 2
    g.strokeStyle = rgba(INK, 0.62)
    g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)

    /* poché — the slab the section plane cuts through */
    if (i === cut) {
      g.fillStyle = rgba(INK, 0.62)
      g.fillRect(r.x, r.y, r.w, Math.max(2, bx.h * 0.016))
    }
  }

  /* floor plates + mullions inside the tall volume */
  const T = bayRects[tall]
  g.lineWidth = hair
  g.strokeStyle = rgba(INK, 0.30)
  g.beginPath()
  const floors = 3 + Math.floor(rnd() * 2)
  for (let i = 1; i < floors; i++) {
    const y = Math.round(T.y + (T.h * i) / floors) + 0.5
    g.moveTo(T.x, y)
    g.lineTo(T.x + T.w, y)
  }
  const mull = 3
  for (let i = 1; i < mull; i++) {
    const x = Math.round(T.x + (T.w * i) / mull) + 0.5
    g.moveTo(x, T.y)
    g.lineTo(x, T.y + T.h)
  }
  g.stroke()

  /* canopy line running off the composition, on columns */
  const capY = Math.round(T.y - bx.h * 0.055) + 0.5
  g.lineWidth = hair * 2.2
  g.strokeStyle = rgba(INK, 0.5)
  g.beginPath()
  g.moveTo(bandX - bx.w * 0.035, capY)
  g.lineTo(bx.x1, capY)
  g.stroke()

  g.lineWidth = hair
  g.strokeStyle = rgba(INK, 0.28)
  g.beginPath()
  for (let i = 0; i < 3; i++) {
    const x = Math.round(bandX + bandW + ((bx.x1 - bandX - bandW) * (i + 0.6)) / 3) + 0.5
    g.moveTo(x, capY)
    g.lineTo(x, gy)
  }
  g.stroke()

  /* -------------------------------------------------------- 4 sun + arc */
  const sx = bx.x1 - bx.w * 0.115
  const sy = bx.y0 + bx.h * 0.15
  const sr = bx.w * 0.048
  g.lineWidth = hair * 1.8
  g.strokeStyle = rgba(ACC, 0.9)
  g.beginPath()
  g.arc(sx, sy, sr, 0, Math.PI * 2)
  g.stroke()

  g.lineWidth = hair
  g.strokeStyle = rgba(INK, 0.26)
  g.setLineDash([hair * 5, hair * 6])
  g.beginPath()
  g.moveTo(bx.x0 + bx.w * 0.08, bx.y0 + bx.h * 0.30)
  g.quadraticCurveTo(bx.x0 + bx.w * 0.55, bx.y0 - bx.h * 0.08, sx, sy)
  g.stroke()
  g.setLineDash([])

  /* --------------------------------------------------------- 5 ground */
  g.lineWidth = hair * 2.8
  g.strokeStyle = rgba(INK, 0.72)
  g.beginPath()
  g.moveTo(bx.x0, gy + 0.5)
  g.lineTo(bx.x1, gy + 0.5)
  g.stroke()

  g.save()
  g.beginPath()
  g.rect(bx.x0, gy + 1, bx.w, bx.h * 0.055)
  g.clip()
  g.lineWidth = hair
  g.strokeStyle = rgba(INK, 0.22)
  g.beginPath()
  const hs = Math.max(6, W * 0.013)
  for (let x = bx.x0 - bx.h; x < bx.x1 + bx.h; x += hs) {
    g.moveTo(x, gy + bx.h * 0.06)
    g.lineTo(x + bx.h * 0.06, gy)
  }
  g.stroke()
  g.restore()

  /* ------------------------------------------------------ 6 dimension */
  const dimY = Math.round(gy + bx.h * 0.125) + 0.5
  const dx0 = bandX
  const dx1 = bandX + bandW
  g.font = monoFont(H * 0.026, 500)
  const dimLabel = String(project.size || '').toUpperCase()
  const dimTrack = H * 0.0055
  const dimW = trackedWidth(g, dimLabel, dimTrack)
  const gap = dimW * 0.5 + bx.w * 0.018

  g.lineWidth = hair * 1.4
  g.strokeStyle = rgba(INK, 0.48)
  g.beginPath()
  g.moveTo(dx0, dimY)
  g.lineTo((dx0 + dx1) / 2 - gap, dimY)
  g.moveTo((dx0 + dx1) / 2 + gap, dimY)
  g.lineTo(dx1, dimY)
  const tick = bx.h * 0.018
  g.moveTo(dx0 - tick, dimY + tick)
  g.lineTo(dx0 + tick, dimY - tick)
  g.moveTo(dx1 - tick, dimY + tick)
  g.lineTo(dx1 + tick, dimY - tick)
  g.moveTo(dx0 + 0.5, gy + bx.h * 0.02)
  g.lineTo(dx0 + 0.5, dimY + tick * 1.4)
  g.moveTo(dx1 + 0.5, gy + bx.h * 0.02)
  g.lineTo(dx1 + 0.5, dimY + tick * 1.4)
  g.stroke()

  g.fillStyle = rgba(INK, 0.62)
  tracked(g, dimLabel, (dx0 + dx1) / 2 - dimW / 2, dimY + H * 0.009, dimTrack)

  /* ------------------------------------------------------- 7 top right */
  g.font = monoFont(H * 0.024, 500)
  const svc = SERVICE.toUpperCase()
  const svcTrack = H * 0.0075
  const svcW = trackedWidth(g, svc, svcTrack)
  const swatch = H * 0.018
  g.fillStyle = rgba(ACC, 0.95)
  g.fillRect(bx.x1 - svcW - swatch * 1.9, bx.y0 + H * 0.005, swatch, swatch)
  g.fillStyle = rgba(INK, 0.62)
  tracked(g, svc, bx.x1 - svcW, bx.y0 + H * 0.021, svcTrack)

  /* ----------------------------------------------------- 8 title block */
  const tbY = bx.y1 - bx.h * 0.155
  g.lineWidth = hair * 1.6
  g.strokeStyle = rgba(INK, 0.34)
  g.beginPath()
  g.moveTo(bx.x0, Math.round(tbY) + 0.5)
  g.lineTo(bx.x1, Math.round(tbY) + 0.5)
  g.stroke()

  g.font = monoFont(H * 0.055, 600)
  g.fillStyle = rgba(INK, 0.9)
  tracked(g, String(project.name).toUpperCase(), bx.x0, bx.y1 - H * 0.048, H * 0.009)

  g.font = monoFont(H * 0.026, 450)
  g.fillStyle = rgba(INK, 0.55)
  tracked(
    g,
    `${project.location}   ·   ${project.year}   ·   ${String(project.type).toUpperCase()}`,
    bx.x0,
    bx.y1 - H * 0.008,
    H * 0.0065
  )

  g.font = monoFont(H * 0.026, 500)
  const sheet = `${SHEET_NO[p.kind] || 'A-0'}`
  const counter = `${pad(ordinal)} / ${pad(total)}`
  const cTrack = H * 0.008
  g.fillStyle = rgba(INK, 0.7)
  tracked(g, counter, bx.x1 - trackedWidth(g, counter, cTrack), bx.y1 - H * 0.008, cTrack)
  g.fillStyle = rgba(INK, 0.42)
  tracked(g, sheet, bx.x1 - trackedWidth(g, sheet, cTrack), bx.y1 - H * 0.048, cTrack)

  /* -------------------------------------------------------- 9 furniture */
  g.lineWidth = hair * 1.4
  g.strokeStyle = rgba(INK, 0.3)
  const cm = M * 0.42
  g.beginPath()
  const corners = [
    [bx.x0, bx.y0, 1, 1], [bx.x1, bx.y0, -1, 1],
    [bx.x0, bx.y1, 1, -1], [bx.x1, bx.y1, -1, -1],
  ]
  for (const [x, y, ix, iy] of corners) {
    g.moveTo(x, y - iy * cm)
    g.lineTo(x, y)
    g.lineTo(x + ix * cm, y)
  }
  g.stroke()

  /* ------------------------------------------------ 10 grain + vignette */
  const grains = Math.round((W * H) / 900)
  g.fillStyle = rgba(INK, 0.05)
  for (let i = 0; i < grains; i++) {
    g.fillRect((rnd() * W) | 0, (rnd() * H) | 0, 1, 1)
  }

  const vig = g.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.24, W * 0.5, H * 0.5, W * 0.78)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, rgba(INK, 0.13))
  g.fillStyle = vig
  g.fillRect(0, 0, W, H)
}

/* ------------------------------------------------------- FLAT FALLBACK  */

function fallbackCard(p) {
  return (
    `<article class="gallery3d__fcard">` +
    `<div class="gallery3d__fplate frame frame--16-9">` +
    plateHTML(p.plate, { label: p.name, index: p.index, width: 1000, height: 562, density: 0.9 }) +
    `</div>` +
    `<div class="gallery3d__fmeta">` +
    `<p class="t-mono gallery3d__fidx">${esc(p.index)} — ${esc(SERVICE)}</p>` +
    `<h3 class="gallery3d__fname">${esc(p.name)}</h3>` +
    `<p class="t-mono gallery3d__fdata">${esc(p.location)} / ${esc(p.year)} / ${esc(p.type)}</p>` +
    `<a class="link-u gallery3d__flink" href="/projects/#${esc(p.id)}">View project</a>` +
    `</div>` +
    `</article>`
  )
}

/* ========================================================================== */
/*  INIT                                                                      */
/* ========================================================================== */

export default function initGallery3d(ctx) {
  const root = document.querySelector(`[data-section="${SLUG}"]`)
  if (!root) return

  const set = projects.slice(0, COUNT_MAX)
  const stageEl = qs('.gallery3d__stage', root)
  const fallbackEl = qs('.gallery3d__fallback', root)
  if (!stageEl || !fallbackEl) return

  /* Without the carousel the stage is inert scenery — it must not stay
     focusable, keyboard-labelled, or advertise a drag cursor. */
  const renderFallback = () => {
    for (const attr of ['tabindex', 'role', 'aria-roledescription', 'aria-label', 'data-cursor', 'data-cursor-text']) {
      stageEl.removeAttribute(attr)
    }
    fallbackEl.innerHTML = set.map(fallbackCard).join('')
  }

  /* Reduced motion → a static, fully legible grid of the same plates. */
  if (ctx.reduced) {
    root.classList.add('gallery3d--static')
    renderFallback()
    return
  }

  /* No WebGL → the CSS scroll-snap row inside .gl-slot__fallback. */
  if (document.documentElement.classList.contains('no-webgl')) {
    renderFallback()
    return
  }

  /* ------------------------------------------------------------- CHROME */
  const nameEl = qs('[data-g3="name"]', root)
  const serviceEl = qs('[data-g3="service"]', root)
  const metaEl = qs('[data-g3="meta"]', root)
  const locEl = qs('[data-g3="location"]', root)
  const yearEl = qs('[data-g3="year"]', root)
  const typeEl = qs('[data-g3="type"]', root)
  const curEl = qs('[data-g3="current"]', root)
  const totalEl = qs('[data-g3="total"]', root)
  const dotsEl = qs('[data-g3="dots"]', root)
  const liveEl = qs('[data-g3="live"]', root)
  const srNavEl = qs('[data-g3="srnav"]', root)
  const hintEl = qs('.gallery3d__hint', root)

  if (srNavEl) {
    srNavEl.innerHTML =
      `<h3>Projects in the visualisation carousel</h3><ol>` +
      set
        .map(
          (p) =>
            `<li><a href="/projects/#${esc(p.id)}">${esc(p.index)} — ${esc(p.name)}, ` +
            `${esc(p.location)}, ${esc(p.year)}. ${esc(p.type)}, ${esc(SERVICE)}.</a></li>`
        )
        .join('') +
      `</ol>`
  }
  if (hintEl && ctx.touch) {
    const label = qs('span', hintEl)
    if (label) label.textContent = 'Swipe to rotate'
  }

  /* --------------------------------------------------------- CARD TEXTURES */
  const texSize = TEX[ctx.tier] || TEX.mid
  const plates = set.map((p, i) => {
    const cv = document.createElement('canvas')
    cv.width = texSize[0]
    cv.height = texSize[1]
    paintCard(cv, p, i + 1, set.length)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    return { cv, tex, project: p, ordinal: i + 1 }
  })

  /* Fonts arrive after first paint — repaint once they do so the mono
     title blocks are set in JetBrains Mono rather than a fallback. */
  document.fonts?.ready?.then(() => {
    plates.forEach((pl) => {
      paintCard(pl.cv, pl.project, pl.ordinal, set.length)
      pl.tex.needsUpdate = true
    })
  })

  /* ------------------------------------------------------------ 3D SCENE */
  const cards = []
  const holders = new Array(set.length).fill(null)

  let ring = null
  let tiltGroup = null
  let modelPivot = null
  let cam = null
  let slot = null

  const mqNarrow = window.matchMedia('(max-width: 900px)')
  const showModel = ctx.tier !== 'low'

  let isNarrow = mqNarrow.matches
  let count = 0
  let stepAngle = Math.PI / 3
  let ringR = 3.7
  let baseScale = 1
  let modelScale = 0.42
  let pxPerCard = 220
  let radPerPx = stepAngle / pxPerCard
  let index = 0
  // Kept clear of the card's bottom title block (the card spans y -1 .. 1,
  // and the block occupies roughly the lowest quarter of it).
  const anchor = new THREE.Vector2(1.06, -0.16)
  /* Scrubbed 0 → 1 as the section arrives: the ring rises out of the page. */
  const intro = { v: 0 }

  /* One number drives everything. */
  const proxy = document.createElement('div')
  gsap.set(proxy, { x: 0 })
  const gp = gsap.getProperty(proxy)
  const getX = () => Number(gp('x')) || 0

  const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a))
  const wrapIdx = (i) => ((i % count) + count) % count
  const slotW = () => Math.max(1, slot?.rect.width || stageEl.clientWidth || 1)
  const slotH = () => Math.max(1, slot?.rect.height || stageEl.clientHeight || 1)

  /* --------------------------------------------------------------- BUILD */
  function buildCards() {
    const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1)
    const backGeo = roundedBox(CARD_W * 1.055, CARD_H * 1.08, 0.055, 0.022, 1)

    plates.forEach((pl, i) => {
      const group = new THREE.Group()
      group.name = `card-${i}`

      const mat = new THREE.MeshBasicMaterial({
        map: pl.tex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      group.add(mesh)

      const backMat = plasterMaterial(PAL.paper)
      backMat.transparent = true
      backMat.depthWrite = false
      const back = new THREE.Mesh(backGeo, backMat)
      back.position.z = -0.045
      group.add(back)

      const edge = edgeOverlay(geo, PAL.ink, 0.24, 1)
      edge.position.z = 0.002
      group.add(edge)

      ring.add(group)
      cards.push({
        group,
        mat,
        backMat,
        edgeMat: edge.material,
        baseAngle: 0,
        on: true,
        project: pl.project,
      })
    })
  }

  function getHolder(i) {
    if (!showModel) return null
    if (holders[i]) return holders[i]
    const holder = new THREE.Group()
    const seed = (set[i].plate && set[i].plate.seed) || i + 1
    const model = buildMassing({
      seed,
      scale: 1,
      tier: ctx.tier,
      accent: PAL.terra,
      withEdges: true,
      center: true,
      shadow: true,
    })
    holder.add(model)
    holder.scale.setScalar(0.001)
    holder.rotation.y = -0.55
    holder.visible = false
    modelPivot.add(holder)
    holders[i] = holder
    return holder
  }

  function swapModel(i) {
    if (!showModel) return
    const next = getHolder(i)
    holders.forEach((h) => {
      if (!h || h === next || !h.visible) return
      gsap.to(h.scale, {
        x: 0.001, y: 0.001, z: 0.001,
        duration: 0.4,
        ease: 'power2.in',
        overwrite: true,
        onComplete: () => { h.visible = false },
      })
    })
    if (!next) return
    next.visible = true
    gsap.killTweensOf(next.scale)
    gsap.killTweensOf(next.rotation)
    gsap.fromTo(
      next.scale,
      { x: 0.001, y: 0.001, z: 0.001 },
      { x: modelScale, y: modelScale, z: modelScale, duration: 0.95, ease: EASE.back, overwrite: true }
    )
    gsap.fromTo(
      next.rotation,
      { y: -0.5 },
      { y: 0, duration: 1.1, ease: EASE.out, overwrite: true }
    )
  }

  /* -------------------------------------------------------------- LAYOUT */
  function frameCamera() {
    if (!cam) return
    const aspect = slotW() / slotH()
    const wFrac = aspect < 1.3 ? 0.86 : 0.74
    const hFrac = 0.68
    const need = Math.max(
      (CARD_H * baseScale) / hFrac,
      (CARD_W * baseScale) / wFrac / Math.max(0.35, aspect)
    )
    const dist = fitDistance(cam, need)
    cam.position.set(0, 0.26, ringR + 0.4 + dist)
    cam.lookAt(0, 0.02, 0)
    cam.updateProjectionMatrix()
  }

  function layout() {
    isNarrow = mqNarrow.matches
    count = Math.min(ctx.tier === 'low' ? 4 : isNarrow ? 5 : 6, cards.length)
    stepAngle = (Math.PI * 2) / count
    baseScale = isNarrow ? 0.85 : 1
    ringR = (CARD_W * baseScale * 0.585) / Math.sin(Math.PI / count)
    modelScale = isNarrow ? 0.3 : 0.42
    anchor.set(isNarrow ? 0.76 : 1.06, isNarrow ? -0.12 : -0.16)
    if (modelPivot) modelPivot.position.z = ringR + (isNarrow ? 0.82 : 1.0)

    cards.forEach((c, i) => {
      c.on = i < count
      c.baseAngle = i * stepAngle
      c.group.rotation.set(0, c.baseAngle, 0)
      c.group.visible = c.on
    })

    pxPerCard = clamp(Math.round(slotW() * 0.3), 120, 300)
    radPerPx = stepAngle / pxPerCard
    index = Math.min(index, count - 1)
    gsap.killTweensOf(proxy)
    gsap.set(proxy, { x: -index * pxPerCard })
    if (ring) ring.rotation.y = -index * stepAngle

    buildDots()
    paintIndex(index)
    setCaption(cards[index].project, true)
    swapModel(index)
    frameCamera()
  }

  function remap() {
    const next = clamp(Math.round(slotW() * 0.3), 120, 300)
    if (next === pxPerCard) return
    const logical = Math.round(-getX() / pxPerCard)
    pxPerCard = next
    radPerPx = stepAngle / pxPerCard
    gsap.killTweensOf(proxy)
    gsap.set(proxy, { x: -logical * pxPerCard })
  }

  /* ------------------------------------------------------------ CHROME UI */
  let changeCall = null

  function buildDots() {
    if (!dotsEl) return
    dotsEl.innerHTML = ''
    for (let i = 0; i < count; i++) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'gallery3d__dot'
      b.dataset.g3Dot = String(i)
      b.setAttribute('aria-label', `Show ${cards[i].project.name}`)
      dotsEl.appendChild(b)
    }
  }

  function paintIndex(i) {
    if (curEl) curEl.textContent = pad(i + 1)
    if (totalEl) totalEl.textContent = pad(count)
    qsa('[data-g3-dot]', dotsEl || root).forEach((d, k) => {
      const on = k === i
      d.classList.toggle('is-active', on)
      if (on) d.setAttribute('aria-current', 'true')
      else d.removeAttribute('aria-current')
    })
  }

  /* Each transition mounts a brand-new inner node before splitting it. That
     keeps SplitText's revert/restore cycle away from text we have already
     replaced — the discarded node takes its own split spans with it. */
  function mountName(text) {
    if (!nameEl) return null
    nameEl.textContent = ''
    const inner = document.createElement('span')
    inner.className = 'gallery3d__cap-inner'
    inner.textContent = text
    nameEl.appendChild(inner)
    return inner
  }

  function setCaption(p, instant) {
    if (!nameEl) return
    if (liveEl) liveEl.textContent = `${p.name}. ${p.location}. ${p.year}. ${p.type}.`

    const writeMeta = () => {
      if (locEl) locEl.textContent = p.location
      if (yearEl) yearEl.textContent = p.year
      if (typeEl) typeEl.textContent = p.type
    }

    if (instant) {
      writeMeta()
      mountName(p.name)
      gsap.set([nameEl, serviceEl, metaEl].filter(Boolean), { opacity: 1, y: 0 })
      return
    }

    const fade = [serviceEl, metaEl].filter(Boolean)
    const tl = gsap.timeline()
    tl.to([nameEl, ...fade], {
      opacity: 0,
      y: -8,
      duration: 0.22,
      ease: 'power2.in',
      overwrite: true,
    })
    tl.add(() => {
      writeMeta()
      const inner = mountName(p.name)
      const split = splitText(inner, {
        type: 'lines,chars',
        mask: 'lines',
        autoSplit: false,
        reduceWhiteSpace: true,
      })
      const targets = split && split.chars && split.chars.length ? split.chars : inner
      gsap.set(nameEl, { opacity: 1, y: 0 })
      gsap.fromTo(
        targets,
        { yPercent: 118 },
        { yPercent: 0, duration: 0.66, ease: EASE.out, stagger: 0.016 }
      )
    })
    tl.fromTo(
      fade,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.44, stagger: 0.06, ease: EASE.out },
      '<0.05'
    )
  }

  /* One debounced commit for caption + study model, so a fast fling through
     four cards animates the card it lands on, not every card it passed. */
  function queueChange() {
    changeCall?.kill()
    changeCall = gsap.delayedCall(0.1, () => {
      setCaption(cards[index].project, false)
      swapModel(index)
    })
  }

  /* -------------------------------------------------------------- MOTION */
  let drag = null
  let dragging = false
  let lastInteract = performance.now() - IDLE_MS
  let lastAuto = performance.now()
  let lastFrame = performance.now()
  let hinted = false

  function killMotion() {
    gsap.killTweensOf(proxy)
    if (drag && drag.tween) drag.tween.kill()
  }

  function slideTo(x, dur) {
    killMotion()
    gsap.to(proxy, { x, duration: dur ?? DUR.slow, ease: EASE.out, overwrite: true })
  }

  function nearestX() {
    return Math.round(getX() / pxPerCard) * pxPerCard
  }

  function goBy(d, dur) {
    slideTo(nearestX() - d * pxPerCard, dur)
  }

  function goTo(i, dur) {
    const cur = Math.round(-getX() / pxPerCard)
    let diff = (((i - wrapIdx(cur)) % count) + count) % count
    if (diff > count / 2) diff -= count
    goBy(diff, dur)
  }

  function interact() {
    lastInteract = performance.now()
    if (hinted || !hintEl) return
    hinted = true
    gsap.to(hintEl, { opacity: 0, y: 8, duration: 0.5, ease: EASE.out, overwrite: true })
  }

  /* ------------------------------------------------------------ THE SLOT */
  slot = stage.createSlot({
    el: stageEl,
    fov: FOV,
    near: 0.1,
    far: 80,

    setup({ scene, camera }) {
      cam = camera
      lightingRig(scene, { intensity: 0.92, shadows: false, sunPosition: [5.5, 7.5, 6] })

      tiltGroup = new THREE.Group()
      scene.add(tiltGroup)

      ring = new THREE.Group()
      tiltGroup.add(ring)

      modelPivot = new THREE.Group()
      tiltGroup.add(modelPivot)

      buildCards()
      layout()
    },

    resize() {
      if (mqNarrow.matches !== isNarrow) layout()
      else {
        remap()
        frameCamera()
      }
    },

    update({ dt, slot: s }) {
      const now = performance.now()
      /* Returning to the section after a while must not fire autoplay at once. */
      if (now - lastFrame > 700) {
        lastInteract = now
        lastAuto = now
      }
      lastFrame = now

      const x = getX()
      ring.rotation.y = damp(ring.rotation.y, x * radPerPx, 16, dt)

      const li = wrapIdx(Math.round(-x / pxPerCard))
      if (li !== index) {
        index = li
        paintIndex(index)
        queueChange()
      }

      const px = s.pointerSmooth.x
      const py = s.pointerSmooth.y
      const iv = intro.v
      tiltGroup.rotation.y = px * 0.05
      tiltGroup.rotation.x = -py * 0.055 + (1 - iv) * 0.16
      tiltGroup.position.y = py * 0.05 - (1 - iv) * 0.5

      for (const c of cards) {
        if (!c.on) continue
        const a = wrapPi(c.baseAngle + ring.rotation.y)
        const abs = Math.abs(a)
        const t = abs / Math.PI
        const focus = Math.max(0, 1 - abs / stepAngle)
        const op = clamp(1.08 - t * 1.9, 0, 1) * iv
        c.group.visible = op > 0.015
        if (!c.group.visible) continue

        const r = ringR + 0.4 * focus - 0.36 * t
        c.group.position.set(Math.sin(c.baseAngle) * r, -0.07 * (1 - focus), Math.cos(c.baseAngle) * r)
        c.group.scale.setScalar(baseScale * (1 + 0.085 * focus) * (0.9 + 0.1 * iv))
        c.group.rotation.set(-py * 0.1 * focus, c.baseAngle + px * 0.1 * focus, 0)

        c.mat.opacity = op
        c.mat.color.setScalar(0.72 + 0.28 * focus)
        c.backMat.opacity = op * 0.95
        c.edgeMat.opacity = op * (0.14 + 0.2 * focus)
      }

      if (showModel && modelPivot) {
        modelPivot.visible = iv > 0.4
        modelPivot.position.x = anchor.x + px * 0.26
        modelPivot.position.y = anchor.y + py * 0.16 + Math.sin(now * 0.0009) * 0.035
        modelPivot.rotation.y += dt * 0.24
        modelPivot.rotation.x = -py * 0.09
      }

      /* Autoplay: wide viewports only, idle, unhovered, not being dragged. */
      if (
        !isNarrow &&
        !ctx.touch &&
        !dragging &&
        !s.hovered &&
        now - lastInteract > IDLE_MS &&
        now - lastAuto > AUTO_MS
      ) {
        lastAuto = now
        slideTo(nearestX() - pxPerCard, 1.7)
      }
    },
  })

  if (!slot) {
    renderFallback()
    return
  }

  /* -------------------------------------------------------------- INPUTS */
  const pointerCursor = ctx.touch ? 'grab' : 'none'

  drag = Draggable.create(proxy, {
    type: 'x',
    trigger: stageEl,
    inertia: true,
    throwResistance: 2400,
    dragResistance: 0.06,
    allowNativeTouchScrolling: true,
    allowContextMenu: true,
    cursor: pointerCursor,
    activeCursor: ctx.touch ? 'grabbing' : 'none',
    snap: { x: (v) => Math.round(v / pxPerCard) * pxPerCard },
    onPress() {
      killMotion()
      this.update()
      dragging = true
      interact()
    },
    onDrag: interact,
    onRelease() {
      dragging = false
      interact()
      const self = this
      requestAnimationFrame(() => {
        if (!self.isThrowing && !gsap.isTweening(proxy)) slideTo(nearestX(), 0.55)
      })
    },
    onThrowComplete: interact,
  })[0]

  /* Horizontal wheel / trackpad intent only — vertical always scrolls the page. */
  let wheelSettle = null
  stageEl.addEventListener(
    'wheel',
    (e) => {
      /* deltaMode 1 reports lines, 2 reports pages — normalise to pixels. */
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? slotW() : 1
      const dx = e.deltaX * unit
      const ax = Math.abs(dx)
      const ay = Math.abs(e.deltaY * unit)
      if (ax < 4 || ax <= ay * 1.25) return
      e.preventDefault()
      killMotion()
      interact()
      gsap.set(proxy, { x: getX() - dx * 0.62 })
      wheelSettle?.kill()
      wheelSettle = gsap.delayedCall(0.15, () => slideTo(nearestX(), 0.5))
    },
    { passive: false }
  )

  stageEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      interact()
      goBy(-1, 0.8)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      interact()
      goBy(1, 0.8)
    } else if (e.key === 'Home') {
      e.preventDefault()
      interact()
      goTo(0, 0.9)
    } else if (e.key === 'End') {
      e.preventDefault()
      interact()
      goTo(count - 1, 0.9)
    }
  })

  qsa('[data-g3-step]', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      interact()
      goBy(Number(btn.dataset.g3Step) || 1, 0.8)
    })
  })

  dotsEl?.addEventListener('click', (e) => {
    const dot = e.target.closest?.('[data-g3-dot]')
    if (!dot) return
    interact()
    goTo(Number(dot.dataset.g3Dot) || 0, 0.9)
  })

  const onMQ = () => layout()
  if (mqNarrow.addEventListener) mqNarrow.addEventListener('change', onMQ)
  else mqNarrow.addListener(onMQ)

  /* Entrance — the ring lifts and fades up as the section arrives. */
  gsap.to(intro, {
    v: 1,
    duration: DUR.slower,
    ease: EASE.out,
    scrollTrigger: { trigger: stageEl, start: 'top 88%', once: true },
    onComplete: () => {
      lastInteract = performance.now()
      lastAuto = performance.now()
    },
  })
}
