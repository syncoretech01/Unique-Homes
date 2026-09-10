/* ============================================================================
   ANATOMY — THE EXPLODING OBJECT

   A pinned, scrubbed exploded assembly. One shared-renderer slot holds the
   courtyard house from models.js; a scrubbed ScrollTrigger drives
   explodeTimeline() while the camera orbits and pulls back. As each assembly
   lands, every other layer desaturates toward the sheet colour, an HTML
   callout projects itself onto the part's world anchor and a leader line is
   drawn between the two. A layer index down the right edge tracks progress and
   doubles as a set of scroll shortcuts.

   Degradation, in order of severity:
     · below 900px  — no pin, no scrub; the model turns slowly, the layers are
                      read as an accordion.
     · reduced      — no pin, no motion; the model rests in a held exploded
                      pose and the accordion carries the whole set.
     · no-webgl     — a generated exploded axonometric replaces the model.
     · tier 'low'   — four assemblies, no leader lines, no site or interior.
   ========================================================================== */

import './anatomy.css'
import { gsap, ScrollTrigger, EASE, queueRefresh } from '../../core/motion.js'
import { scrollTo } from '../../core/scroll.js'
import { qs, el, clamp, lerp, pad } from '../../lib/utils.js'
import { stage, THREE } from '../../core/webgl/stage.js'
import { buildHouse, explodeTimeline } from '../../core/webgl/models.js'
import { lightingRig, color } from '../../core/webgl/materials.js'
import { drawingSVG } from '../../lib/drawings.js'

/* ------------------------------------------------------------------------ */
/*  LAYER COPY — mirrors the userData carried by buildHouse()'s parts, so the */
/*  text fallbacks say exactly what the 3D callouts say.                      */
/* ------------------------------------------------------------------------ */

const PART_META = [
  {
    key: 'site',
    code: 'S-01',
    label: 'Site & grading',
    info: 'Graded plate with a 150 mm contour step, setting-out grid and the driveway approach.',
  },
  {
    key: 'foundation',
    code: 'F-02',
    label: 'Foundation',
    info: 'Insulated raft on perimeter edge beams and mass-concrete piers.',
  },
  {
    key: 'structure',
    code: 'ST-03',
    label: 'Structure',
    info: 'Exposed oak post-and-beam frame on a 1.8 m bay grid, with joists and rafters.',
  },
  {
    key: 'envelope',
    code: 'EN-04',
    label: 'Envelope',
    info: 'Board-formed concrete blades with rendered plaster infill panels.',
  },
  {
    key: 'glazing',
    code: 'GL-05',
    label: 'Glazing',
    info: 'Full-height low-iron glazing on 55 mm blackened steel mullions.',
  },
  {
    key: 'roof',
    code: 'RF-06',
    label: 'Roof',
    info: 'Warm-deck roof plate, 600 mm eave, timber soffit and a steel fascia edge.',
  },
  {
    key: 'interior',
    code: 'IN-07',
    label: 'Interior',
    info: 'Floor plates, feature stair, service core and loose furniture.',
  },
  {
    key: 'landscape',
    code: 'LS-08',
    label: 'Landscape',
    info: 'Courtyard planting, specimen trees and a low garden wall.',
  },
]

/** Assemblies kept on the cheapest devices — a legible build-up, nothing more. */
const LOW_KEYS = ['foundation', 'structure', 'envelope', 'roof']

/* ------------------------------------------------------------------- TUNING */

const SVG_NS = 'http://www.w3.org/2000/svg'

const PIN_VIEWPORTS = 3.5 // pin length, in viewport heights
const P_IN = 0.055 //        master progress: hold assembled until here
const P_OUT = 0.855 //       master progress: fully apart here, settle after
const STAGGER = 0.46 //      explodeTimeline segment overlap
const LAND = 0.82 //         fraction of a part's travel before it goes active
const SETTLE_BACK = 0.11 //  how far the assembly draws back in at the end
const STATIC_P = 0.62 //     held pose for prefers-reduced-motion

const AZ_0 = 0.74 //         camera azimuth, assembled → apart (radians)
const AZ_1 = 1.72
const EL_0 = 0.28 //         camera elevation, assembled → apart (radians)
const EL_1 = 0.45

const DIM_MAX = 0.74 //      strongest desaturation applied to inactive layers
const DIM_TARGET = color(0xcdd3d8) // sheet grey the inactive layers lerp toward

const CARD_GAP = 74 //       px between the 3D anchor and the callout edge
const EDGE = 14 //           px the callout is kept clear of the viewport edge

const smoothstep = (t) => t * t * (3 - 2 * t)

/* ------------------------------------------------------------------------ */
/*  ENTRY                                                                    */
/* ------------------------------------------------------------------------ */

export default function initAnatomy(ctx) {
  const root = document.querySelector('[data-section="anatomy"]')
  if (!root) return

  const dom = {
    stageEl: qs('[data-anatomy-stage]', root),
    pin: qs('[data-anatomy-pin]', root),
    viewport: qs('[data-anatomy-viewport]', root),
    mount: qs('[data-anatomy-mount]', root),
    fallback: qs('[data-anatomy-fallback]', root),
    leaders: qs('[data-anatomy-leaders]', root),
    callouts: qs('[data-anatomy-callouts]', root),
    index: qs('[data-anatomy-index]', root),
    list: qs('[data-anatomy-list]', root),
    rail: qs('[data-anatomy-rail]', root),
    railFill: qs('[data-anatomy-rail-fill]', root),
    count: qs('[data-anatomy-count]', root),
    total: qs('[data-anatomy-total]', root),
  }
  if (!dom.mount || !dom.viewport) return

  /* The full set always exists as text — it is the accessible spine of the
     section and the only content when the 3D layer cannot run. */
  buildAccordion(dom.list, PART_META)

  const noWebGL = document.documentElement.classList.contains('no-webgl')

  /* --------------------------------------------------------------- NO GL  */
  if (noWebGL) {
    mountAxonFallback(dom.fallback)
    root.classList.add('is-flat', 'is-nogl')
    queueRefresh()
    return
  }

  /* --------------------------------------------------------------- SCENE  */
  const scene = createScene(dom, ctx)
  if (!scene) {
    mountAxonFallback(dom.fallback)
    root.classList.add('is-flat', 'is-nogl')
    queueRefresh()
    return
  }

  if (ctx.reduced) root.classList.add('is-flat')
  if (scene.layers.length < PART_META.length) root.classList.add('is-partial')
  if (dom.total) dom.total.textContent = pad(scene.layers.length)

  /* ------------------------------------------------------- OVERLAY + PIN  */
  if (!ctx.reduced) {
    buildOverlay(root, dom, scene, ctx)
  }

  queueRefresh()
}

/* ------------------------------------------------------------------------ */
/*  3D SCENE                                                                 */
/* ------------------------------------------------------------------------ */

function createScene(dom, ctx) {
  /* Shared mutable state read by the per-frame update and written by the
     ScrollTrigger, the matchMedia contexts and the index buttons. */
  const view = {
    mode: ctx.reduced ? 'static' : 'idle', // 'scrub' | 'idle' | 'static'
    p: ctx.reduced ? STATIC_P : 0,
    pTarget: ctx.reduced ? STATIC_P : 0,
    explode: -1,
    active: -1,
    railAt: -1,
    tanV: 0.29,
    tanH: 0.51,
    fit: 1.06,
    ready: false,
    onActive: null,
    onFrame: null,
  }

  const layers = []
  const boxIn = { hH: 4, hW: 9, centre: new THREE.Vector3() }
  const boxOut = { hH: 9, hW: 11, centre: new THREE.Vector3() }
  const look = new THREE.Vector3()
  const anchor = new THREE.Vector3()
  // Reused every frame so the ticker allocates nothing.
  const frame = { active: -1, ax: 0, ay: 0, visible: false, p: 0, dt: 0, width: 1, height: 1 }

  let exploder = null
  let houseGroup = null

  const slot = stage.createSlot({
    el: dom.mount,
    fov: 32,
    near: 0.5,
    far: 400,

    setup({ scene, slot: s }) {
      const low = s.tier === 'low'

      const house = buildHouse({
        seed: 7,
        tier: s.tier,
        detail: low ? 0.5 : 1,
        withSite: !low,
        withInterior: !low,
        lights: false,
      })

      houseGroup = house.group
      scene.add(houseGroup)
      lightingRig(scene, {
        shadowArea: 13,
        sunPosition: [9.5, 13, 7],
        shadows: s.tier !== 'low',
      })

      /* On the low tier the glazing rides with the envelope: four assemblies
         fly apart instead of eight, and no pane is ever left hanging. */
      if (low && house.parts.glazing && house.parts.envelope) {
        house.parts.envelope.add(house.parts.glazing)
      }

      const keys = low ? LOW_KEYS : PART_META.map((m) => m.key)
      houseGroup.updateMatrixWorld(true)

      const box = new THREE.Box3()
      const centre = new THREE.Vector3()

      for (const key of keys) {
        const part = house.parts[key]
        const meta = PART_META.find((m) => m.key === key)
        if (!part || !meta || !part.children.length) continue

        /* Anchor: the part's own centre of mass, nudged toward its top edge so
           the leader line reads as pointing at the assembly, not through it.
           Stored in the part's local frame — a rigid group, so one cheap
           localToWorld() per frame replaces a bounding-box rebuild. */
        box.setFromObject(part)
        if (box.isEmpty()) continue
        box.getCenter(centre)
        centre.y = lerp(centre.y, box.max.y, 0.34)

        layers.push({
          ...meta,
          part,
          anchorLocal: part.worldToLocal(centre.clone()),
          mats: isolateMaterials(part),
          dim: 0,
          dimSet: -1,
          card: null,
          cardIn: null,
          w: 0,
          h: 0,
          item: null,
          act: 0,
          x: 0,
          y: 0,
          seeded: false,
        })
      }

      if (!layers.length) return

      exploder = explodeTimeline(
        layers.map((l) => l.part),
        { duration: 1, stagger: STAGGER, spin: 0.05, lift: low ? 0.78 : 1 }
      )

      /* Activation thresholds read straight off the timeline's own geometry,
         so a callout appears exactly as its part settles into place. */
      const total = 1 + (layers.length - 1) * STAGGER
      layers.forEach((l, i) => {
        l.act = clamp((i * STAGGER + LAND) / total, 0, 1)
      })

      /* Frame the assembled and the fully-apart states once; every frame in
         between is a lerp of the two. */
      measureExtent(houseGroup, boxIn)
      exploder.progress(1)
      houseGroup.updateMatrixWorld(true)
      measureExtent(houseGroup, boxOut)
      exploder.progress(0)
      houseGroup.updateMatrixWorld(true)

      view.ready = true
    },

    resize({ aspect, slot: s }) {
      const vFov = THREE.MathUtils.degToRad(s.camera.fov || 32)
      view.tanV = Math.tan(vFov / 2)
      view.tanH = view.tanV * (aspect || 1)
      /* Portrait crops the site edges rather than shrinking the house to a
         postage stamp; wide viewports get a little breathing room instead. */
      view.fit = aspect < 1 ? 0.95 : aspect < 1.35 ? 1.02 : 1.08
      view.onResize?.()
    },

    update({ dt, elapsed, slot: s, camera }) {
      if (!view.ready) return

      /* ------------------------------------------------------ progress  */
      if (view.mode === 'scrub') {
        const d = view.pTarget - view.p
        // A jump this large means the pin was re-entered: snap, don't glide.
        view.p += Math.abs(d) > 0.2 ? d : d * (1 - Math.exp(-11 * dt))
      } else if (view.mode === 'static') {
        view.p = STATIC_P
      } else {
        view.p = 0
      }

      const seq = clamp((view.p - P_IN) / (P_OUT - P_IN), 0, 1)
      const settle = clamp((view.p - P_OUT) / (1 - P_OUT), 0, 1)
      const e = smoothstep(seq)
      const explode = clamp(seq - settle * SETTLE_BACK, 0, 1)

      if (Math.abs(explode - view.explode) > 1e-4) {
        view.explode = explode
        exploder.progress(explode)
      }

      /* -------------------------------------------------------- camera  */
      let az = AZ_0 + (AZ_1 - AZ_0) * e
      let elev = EL_0 + (EL_1 - EL_0) * e + settle * 0.045

      if (view.mode === 'idle') {
        az = AZ_0 + elapsed * 0.085
        elev = EL_0 + 0.05
      } else if (view.mode === 'static') {
        az = 1.02
        elev = 0.4
      }

      if (view.mode !== 'static' && !ctx.touch) {
        az += s.pointerSmooth.x * 0.075
        elev += s.pointerSmooth.y * 0.05
      }
      elev = clamp(elev, 0.06, 1.1)

      const hH = lerp(boxIn.hH, boxOut.hH, e)
      const hW = lerp(boxIn.hW, boxOut.hW, e)
      look.lerpVectors(boxIn.centre, boxOut.centre, e)

      const ce = Math.cos(elev)
      const se = Math.sin(elev)
      const dist =
        Math.max((hH * ce + hW * se) / view.tanV, hW / view.tanH) * view.fit * (1 + 0.1 * e)

      camera.position.set(
        look.x + dist * ce * Math.sin(az),
        look.y + dist * se,
        look.z + dist * ce * Math.cos(az)
      )
      camera.lookAt(look)
      camera.updateMatrixWorld()

      /* --------------------------------------------------- active layer  */
      let active = -1
      if (view.mode === 'scrub') {
        for (let i = 0; i < layers.length; i += 1) {
          if (seq >= layers[i].act) active = i
        }
      }
      if (active !== view.active) {
        view.active = active
        view.onActive?.(active)
      }

      /* ------------------------------------------------------- dimming  */
      const fade = 1 - Math.exp(-7 * dt)
      for (let i = 0; i < layers.length; i += 1) {
        const layer = layers[i]
        const target = active < 0 ? 0 : i === active ? 0 : DIM_MAX
        layer.dim += (target - layer.dim) * fade
        if (Math.abs(layer.dim - layer.dimSet) > 0.004) {
          layer.dimSet = layer.dim
          applyDim(layer.mats, layer.dim)
        }
      }

      /* ------------------------------------------- projection + overlay  */
      if (view.onFrame) {
        frame.active = active
        frame.visible = false
        frame.ax = 0
        frame.ay = 0
        frame.p = view.p
        frame.dt = dt
        // The stage has already measured this slot for us this frame.
        frame.width = s.rect.width
        frame.height = s.rect.height

        if (active >= 0) {
          const layer = layers[active]
          layer.part.updateWorldMatrix(true, false)
          anchor.copy(layer.anchorLocal)
          layer.part.localToWorld(anchor)
          anchor.project(camera)
          if (anchor.z < 1) {
            frame.ax = (anchor.x * 0.5 + 0.5) * frame.width
            frame.ay = (-anchor.y * 0.5 + 0.5) * frame.height
            frame.visible = true
          }
        }

        view.onFrame(frame)
      }
    },
  })

  if (!slot || !layers.length) return null

  return { slot, view, layers }
}

/** Half-extents used to frame the camera: worst-case width under any azimuth. */
function measureExtent(group, out) {
  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  box.getCenter(out.centre)
  out.hH = Math.max(size.y * 0.5, 0.5)
  out.hW = Math.max(0.5 * Math.hypot(size.x, size.z), 0.5)
}

/* ------------------------------------------------------------------------ */
/*  PER-PART MATERIALS — the house shares materials between assemblies, so    */
/*  each part gets its own clones before anything is dimmed independently.    */
/* ------------------------------------------------------------------------ */

function isolateMaterials(part) {
  const cache = new Map()
  const owned = []

  const take = (src) => {
    let copy = cache.get(src)
    if (copy) return copy
    copy = src.clone()
    copy.userData = {
      ...(copy.userData || {}),
      baseColor: copy.color ? copy.color.clone() : null,
      baseEnv: typeof copy.envMapIntensity === 'number' ? copy.envMapIntensity : null,
    }
    cache.set(src, copy)
    owned.push(copy)
    return copy
  }

  part.traverse((o) => {
    const mat = o.material
    if (!mat) return
    o.material = Array.isArray(mat) ? mat.map(take) : take(mat)
  })

  return owned
}

/** Desaturate a layer toward the sheet grey. One mechanism, opaque, no sorting. */
function applyDim(mats, k) {
  for (let i = 0; i < mats.length; i += 1) {
    const m = mats[i]
    const base = m.userData
    if (base.baseColor) m.color.copy(base.baseColor).lerp(DIM_TARGET, k)
    if (base.baseEnv !== null) m.envMapIntensity = base.baseEnv * (1 - k * 0.7)
  }
}

/* ------------------------------------------------------------------------ */
/*  OVERLAY — callouts, leader lines, layer index, progress rail, the pin     */
/* ------------------------------------------------------------------------ */

function buildOverlay(root, dom, scene, ctx) {
  const { view, layers, slot } = scene
  const withLeaders = slot.tier !== 'low'

  /* ------------------------------------------------------------- index  */
  buildIndex(dom.index, layers, root.id)

  /* ---------------------------------------------------------- callouts  */
  for (const layer of layers) {
    const card = el('div', { class: 'anatomy__callout' })
    const inner = el('div', { class: 'anatomy__callout-in' }, [
      el('span', { class: 'anatomy__callout-code', text: layer.code }),
      el('p', { class: 'anatomy__callout-label', text: layer.label }),
      el('p', { class: 'anatomy__callout-info', text: layer.info }),
    ])
    card.appendChild(inner)
    dom.callouts.appendChild(card)
    layer.card = card
    layer.cardIn = inner
  }
  gsap.set(
    layers.map((l) => l.cardIn),
    { autoAlpha: 0 }
  )

  /* ------------------------------------------------------- leader line  */
  let leaderLine = null
  let leaderDot = null
  let leaderRing = null
  if (withLeaders) {
    leaderLine = document.createElementNS(SVG_NS, 'polyline')
    leaderLine.setAttribute('class', 'anatomy__leader-line')
    leaderRing = document.createElementNS(SVG_NS, 'circle')
    leaderRing.setAttribute('class', 'anatomy__leader-ring')
    leaderRing.setAttribute('r', '7')
    leaderDot = document.createElementNS(SVG_NS, 'circle')
    leaderDot.setAttribute('class', 'anatomy__leader-dot')
    leaderDot.setAttribute('r', '2.5')
    dom.leaders.append(leaderLine, leaderRing, leaderDot)
  } else {
    dom.leaders.remove()
    dom.leaders = null
  }

  /* ------------------------------------------------------ measurements  */
  const measure = () => {
    for (const layer of layers) {
      layer.w = layer.card.offsetWidth
      layer.h = layer.card.offsetHeight
    }
  }
  measure()
  if (document.fonts?.status !== 'loaded') document.fonts?.ready.then(measure)
  view.onResize = measure

  /* ----------------------------------------------------- active change  */
  view.onActive = (active) => {
    layers.forEach((layer, i) => {
      const on = i === active
      if (layer.item) {
        layer.item.classList.toggle('is-active', on)
        layer.item.classList.toggle('is-done', active >= 0 && i <= active)
        layer.btn?.setAttribute('aria-current', on ? 'true' : 'false')
      }
      if (on === layer.card.classList.contains('is-on')) return
      layer.card.classList.toggle('is-on', on)

      if (on) {
        layer.seeded = false
        gsap.fromTo(
          layer.cardIn,
          { autoAlpha: 0, scale: 0.965, y: 10 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.5, ease: EASE.out, overwrite: true }
        )
      } else {
        gsap.to(layer.cardIn, { autoAlpha: 0, duration: 0.22, ease: 'none', overwrite: true })
      }
    })

    if (dom.count) dom.count.textContent = pad(active + 1)
  }

  /* --------------------------------------------------------- per frame  */
  view.onFrame = ({ active, ax, ay, visible, p, dt, width, height }) => {
    if (dom.railFill && Math.abs(p - view.railAt) > 0.001) {
      view.railAt = p
      dom.railFill.style.transform = `scaleX(${p.toFixed(4)})`
    }

    if (active < 0 || !visible) {
      if (dom.leaders) dom.leaders.classList.remove('is-on')
      return
    }
    if (dom.leaders) dom.leaders.classList.add('is-on')

    const layer = layers[active]
    if (!layer.w) {
      measure()
      if (!layer.w) return
    }

    /* Smooth the projected anchor so the callout never chatters, but land it
       immediately the first frame a layer becomes active. */
    const k = layer.seeded ? 1 - Math.exp(-16 * dt) : 1
    layer.seeded = true
    layer.x += (ax - layer.x) * k
    layer.y += (ay - layer.y) * k

    const px = layer.x
    const py = layer.y
    const gap = clamp(width * 0.06, 44, CARD_GAP)
    const side = px < width * 0.5 ? 1 : -1

    let cx = side > 0 ? px + gap : px - gap - layer.w
    let cy = py - layer.h * 0.5
    cx = clamp(cx, EDGE, Math.max(EDGE, width - layer.w - EDGE))
    cy = clamp(cy, EDGE, Math.max(EDGE, height - layer.h - EDGE))

    layer.card.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`
    layer.cardIn.style.transformOrigin = side > 0 ? 'left center' : 'right center'

    if (!leaderLine) return

    const attachX = side > 0 ? cx : cx + layer.w
    const attachY = cy + layer.h * 0.5
    const run = Math.abs(attachX - px)
    const drop = Math.abs(attachY - py)
    const elbowX = px + side * Math.min(drop, run * 0.55)

    leaderLine.setAttribute(
      'points',
      `${px.toFixed(1)},${py.toFixed(1)} ${elbowX.toFixed(1)},${attachY.toFixed(1)} ${attachX.toFixed(1)},${attachY.toFixed(1)}`
    )
    leaderDot.setAttribute('cx', px.toFixed(1))
    leaderDot.setAttribute('cy', py.toFixed(1))
    leaderRing.setAttribute('cx', px.toFixed(1))
    leaderRing.setAttribute('cy', py.toFixed(1))
  }

  /* --------------------------------------------------------------- pin  */
  const mm = gsap.matchMedia()

  mm.add('(min-width: 900px)', () => {
    const trigger = ScrollTrigger.create({
      trigger: dom.stageEl,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * PIN_VIEWPORTS)}`,
      pin: dom.pin,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        view.pTarget = self.progress
      },
      onToggle: (self) => {
        if (self.isActive) view.p = self.progress
      },
    })

    view.mode = 'scrub'
    view.pTarget = trigger.progress
    view.p = trigger.progress
    root.classList.add('is-scrub')
    buildTicks(dom.rail, layers)
    wireIndexJumps(layers, trigger, ctx)

    return () => {
      trigger.kill()
      root.classList.remove('is-scrub')
      view.mode = 'idle'
      view.pTarget = 0
      view.p = 0
      view.active = -1
      view.onActive?.(-1)
      layers.forEach((layer) => {
        if (layer.btn) layer.btn.onclick = null
      })
      if (dom.rail) dom.rail.querySelectorAll('.anatomy__tick').forEach((t) => t.remove())
      if (dom.railFill) dom.railFill.style.transform = 'scaleX(0)'
      view.railAt = -1
    }
  })
}

/* ------------------------------------------------------------------------ */
/*  DOM BUILDERS                                                             */
/* ------------------------------------------------------------------------ */

function buildIndex(list, layers, sectionId) {
  if (!list) return
  const frag = document.createDocumentFragment()

  layers.forEach((layer) => {
    const descId = `${sectionId || 'anatomy'}-layer-${layer.key}`
    const btn = el('button', { class: 'anatomy__index-btn', type: 'button' }, [
      el('span', { class: 'anatomy__index-code', text: layer.code }),
      el('span', { class: 'anatomy__index-label', text: layer.label }),
      el('span', { class: 'anatomy__index-bar', 'aria-hidden': 'true' }),
    ])
    btn.setAttribute('aria-describedby', descId)

    const item = el('li', { class: 'anatomy__index-item' }, [
      btn,
      el('span', { class: 'u-sr', id: descId, text: layer.info }),
    ])

    layer.item = item
    layer.btn = btn
    frag.appendChild(item)
  })

  list.appendChild(frag)
}

function buildTicks(rail, layers) {
  if (!rail) return
  const frag = document.createDocumentFragment()
  for (const layer of layers) {
    const at = P_IN + layer.act * (P_OUT - P_IN)
    const tick = el('span', { class: 'anatomy__tick' })
    tick.style.left = `${(at * 100).toFixed(2)}%`
    frag.appendChild(tick)
  }
  rail.appendChild(frag)
}

function wireIndexJumps(layers, trigger, ctx) {
  layers.forEach((layer, i) => {
    if (!layer.btn) return
    const next = layers[i + 1]
    const centre = layer.act + ((next ? next.act : 1) - layer.act) * 0.45
    const at = P_IN + clamp(centre, 0, 1) * (P_OUT - P_IN)

    layer.btn.onclick = () => {
      const y = trigger.start + (trigger.end - trigger.start) * at
      scrollTo(Math.round(y), { duration: ctx.reduced ? 0 : 1.2 })
    }
  })
}

function buildAccordion(list, metas) {
  if (!list) return
  const frag = document.createDocumentFragment()

  metas.forEach((meta, i) => {
    const trigger = el('button', { class: 'acc__trigger', type: 'button' }, [
      el('span', { class: 'anatomy__acc-q' }, [
        el('span', { class: 'anatomy__acc-code', text: meta.code }),
        el('span', { class: 'acc__q', text: meta.label }),
      ]),
      el('span', { class: 'acc__icon', 'aria-hidden': 'true' }),
    ])

    const panel = el('div', { class: 'acc__panel' }, [
      el('div', { class: 'acc__panel-inner' }, [
        el('p', { class: 'anatomy__acc-info', text: meta.info }),
      ]),
    ])

    const item = el('div', { class: `acc__item${i === 0 ? ' is-open' : ''}` }, [trigger, panel])
    frag.appendChild(item)
  })

  list.appendChild(frag)
}

/* ------------------------------------------------------------------------ */
/*  NO-WEBGL FALLBACK                                                        */
/* ------------------------------------------------------------------------ */

function mountAxonFallback(host) {
  if (!host) return
  /* drawingSVG slices to fill a plate; here the whole sheet has to be legible,
     so the drawing is asked to fit instead. */
  host.innerHTML = drawingSVG('axon', {
    seed: 7,
    label: 'Exploded assembly',
    index: '04',
    width: 1240,
    height: 820,
    density: 1.1,
    ink: '#27415A',
    accent: '#AE4E2A',
  }).replace('preserveAspectRatio="xMidYMid slice"', 'preserveAspectRatio="xMidYMid meet"')
}
