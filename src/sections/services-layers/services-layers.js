/* ============================================================================
   SERVICES — LAYER TRANSFORMATION
   ----------------------------------------------------------------------------
   Three service sheets begin stacked in perspective like tracing paper in a
   drawing set. One pinned ScrollTrigger scrubs a single master timeline that

     · fans the stack apart in 3D,
     · brings each layer forward in turn so it squares up and opens into a
       full panel (title, lede, deliverables, facts, plate),
     · pushes the spent layer down, dim and small, back under the pile,
     · drives a monospaced 01 — 03 counter and a progress rail,
     · parallaxes each procedural drawing plate inside its own frame.

   The timeline snaps to whole layers. Below 900px the whole apparatus is
   reverted by gsap.matchMedia() and the services read as three plain cards.
   ========================================================================== */

import './services-layers.css'
import { gsap, ScrollTrigger, EASE, DUR } from '../../core/motion.js'
import { qs, qsa, pad } from '../../lib/utils.js'
import { services } from '../../data/services.js'
import { plateHTML, blueprintBackgroundCSS, grainDataURI } from '../../lib/drawings.js'

/* ------------------------------------------------------------------------ */
/*  CONSTANTS                                                                */
/* ------------------------------------------------------------------------ */

/** service.accent → the token that tints that layer's rule, index and key line. */
const ACCENT = {
  terra: 'var(--c-terra)',
  blueprint: 'var(--c-blueprint)',
  ochre: 'var(--c-ochre)',
}

/* Procedural drawing per service. Hex lives here only because it is fed to
   generated SVG artwork — never to a stylesheet. */
const PLATES = {
  'architectural-packages': {
    plate: { kind: 'framing', a: '#F4F0E9', b: '#E3DBCA', ink: '#3B342B', accent: '#AE4E2A', seed: 41 },
    caption: 'Roof framing plan',
  },
  'civil-engineering': {
    plate: { kind: 'site', a: '#EEF1F4', b: '#DAE2E9', ink: '#27415A', accent: '#AE4E2A', seed: 27 },
    caption: 'Site & grading plan',
  },
  '3d-renderings': {
    plate: { kind: 'axon', a: '#F6F1E7', b: '#E7DDC8', ink: '#3A3226', accent: '#C2934A', seed: 63 },
    caption: 'Cutaway axonometric',
  },
}

const FALLBACK_PLATE = {
  plate: { kind: 'grid', a: '#F3EFE8', b: '#DFD7C9', ink: '#3B342B', accent: '#AE4E2A', seed: 9 },
  caption: 'Setting-out grid',
}

/* Timeline beats, in arbitrary units. The pinned scroll distance is mapped
   onto the sum of these. */
const FAN = 1.0    // tight stack → fanned, layer 01 forward
const HOLD = 0.6   // dwell on a layer
const MOVE = 1.4   // one layer hands over to the next
const TAIL = 0.9   // final dwell before the pin releases

const DESKTOP = '(min-width: 901px)'
const STACKED = '(max-width: 900px)'

/* ------------------------------------------------------------------------ */
/*  MARKUP                                                                   */
/* ------------------------------------------------------------------------ */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ESCAPES[c])

const ARROW =
  '<svg class="sl-layer__glyph" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
  '<path d="M2.6 9.4 9.4 2.6M4.2 2.6h5.2v5.2" fill="none" stroke="currentColor" stroke-width="1.1" ' +
  'stroke-linecap="square"/></svg>'

/**
 * One service sheet. The whole card is a real link to the service anchor.
 */
function layerHTML(service, i) {
  const art = PLATES[service.id] || FALLBACK_PLATE
  const accent = ACCENT[service.accent] || 'var(--accent)'

  const title = String(service.title || service.label)
    .split('\n')
    .map((line) => `<span class="sl-layer__tl">${esc(line)}</span>`)
    .join('')

  const deliverables = (service.deliverables || [])
    .map((d) => `<li>${esc(d)}</li>`)
    .join('')

  const facts = (service.facts || [])
    .map(
      (f) =>
        `<div class="sl-fact"><dt class="sl-fact__k">${esc(f.k)}</dt>` +
        `<dd class="sl-fact__v">${esc(f.v)}</dd></div>`
    )
    .join('')

  const keywords = (service.keywords || []).map((k) => `<li>${esc(k)}</li>`).join('')

  const plate = plateHTML(art.plate, {
    label: service.label,
    index: service.index,
    showTitleBlock: false,
    width: 820,
    height: 760,
    density: 1,
    strokeScale: 0.85,
  })

  return (
    `<a class="sl-layer" href="/services/#${esc(service.id)}" data-sl-layer data-index="${i}" ` +
    `style="--sl-accent:${accent}">` +
      `<article class="sl-layer__sheet">` +
        `<span class="sl-layer__edge" aria-hidden="true"></span>` +
        `<span class="sl-layer__tooth" data-sl-tooth aria-hidden="true"></span>` +
        `<header class="sl-layer__top">` +
          `<span class="sl-layer__index t-num">${esc(service.index)}</span>` +
          `<span class="sl-layer__label">${esc(service.label)}</span>` +
          ARROW +
        `</header>` +
        `<div class="sl-layer__grid" data-sl-grid>` +
          `<div class="sl-layer__media">` +
            `<div class="sl-layer__frame">` +
              `<div class="sl-layer__plate" data-sl-plate>${plate}</div>` +
              `<span class="sl-layer__cap">${esc(art.caption)}</span>` +
            `</div>` +
            `<ul class="sl-layer__keys">${keywords}</ul>` +
          `</div>` +
          `<div class="sl-layer__body">` +
            `<h3 class="sl-layer__title">${title}</h3>` +
            `<p class="sl-layer__lede">${esc(service.lede)}</p>` +
            `<div class="sl-layer__deliverables">` +
              `<span class="sl-layer__ck">Deliverables</span>` +
              `<ul class="sl-layer__list">${deliverables}</ul>` +
            `</div>` +
            `<dl class="sl-layer__facts">${facts}</dl>` +
            `<span class="sl-layer__cta">` +
              `<span class="sl-layer__cta-text">View ${esc(service.label)}</span>` +
              `<span class="sl-layer__cta-arrow" aria-hidden="true">&rarr;</span>` +
            `</span>` +
          `</div>` +
        `</div>` +
        `<span class="sl-layer__veil" data-sl-veil aria-hidden="true"></span>` +
      `</article>` +
    `</a>`
  )
}

/* ------------------------------------------------------------------------ */
/*  3D POSES                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Where a sheet sits relative to the layer that currently owns the viewer.
 * depth > 0 — still to come: lifted and pushed back, its header peeking out
 *             above the active panel like the next sheet in a set.
 * depth = 0 — square to the viewer, full size, no scrim.
 * depth < 0 — spent: slid down and back under the pile, dimmed.
 */
function poseFor(depth) {
  if (depth === 0) return { y: 0, z: 0, rot: 0, veil: 0 }
  if (depth > 0) {
    const d = depth
    return {
      y: -(64 * d + 8 * d * (d - 1)),
      z: -150 * d,
      rot: 3.5 * d,
      veil: Math.min(0.6, 0.28 + 0.16 * d),
    }
  }
  const d = -depth
  return {
    y: 50 * d + 8 * d * (d - 1),
    z: -(160 * d + 60),
    rot: -5 * d,
    veil: Math.min(0.82, 0.6 + 0.11 * d),
  }
}

/* ------------------------------------------------------------------------ */
/*  INIT                                                                     */
/* ------------------------------------------------------------------------ */

export default function initServicesLayers(ctx = {}) {
  const root = document.querySelector('[data-section="services-layers"]')
  if (!root) return

  const deck = qs('[data-sl-deck]', root)
  if (!deck || !services.length) return

  const total = services.length

  /* ---------------------------------------------------------- backdrop */
  const field = qs('[data-sl-field]', root)
  if (field) {
    field.style.backgroundImage = blueprintBackgroundCSS({ size: 32, major: 4, thickness: 1 })
  }

  /* ------------------------------------------------------------ render */
  deck.innerHTML = services.map(layerHTML).join('')

  const layers = qsa('[data-sl-layer]', deck)
  if (!layers.length) return

  const grain = grainDataURI(96, 0.42, 7)
  qsa('[data-sl-tooth]', deck).forEach((node) => {
    node.style.backgroundImage = `url(${grain})`
  })

  const veils = layers.map((l) => qs('[data-sl-veil]', l))
  const grids = layers.map((l) => qs('[data-sl-grid]', l))
  const plates = layers.map((l) => qs('[data-sl-plate]', l))
  const bodyKids = layers.map((l) => qsa('.sl-layer__body > *', l))

  /* -------------------------------------------------------------- rail */
  const rail = qs('[data-sl-rail]', root)
  const nowEl = qs('[data-sl-now]', root)
  const totalEl = qs('[data-sl-total]', root)
  const fill = qs('[data-sl-fill]', root)
  const ticksWrap = qs('[data-sl-ticks]', root)

  if (totalEl) totalEl.textContent = pad(total)
  if (ticksWrap) {
    ticksWrap.innerHTML = services
      .map(
        (s) =>
          `<li class="sl-rail__tick" data-sl-tick style="--sl-accent:${ACCENT[s.accent] || 'var(--accent)'}">` +
          `<span class="sl-rail__dot"></span>` +
          `<span class="sl-rail__no t-num">${esc(s.index)}</span></li>`
      )
      .join('')
  }
  const ticks = qsa('[data-sl-tick]', root)

  let active = -1
  const setActive = (i) => {
    if (i === active || i < 0 || i >= total) return
    active = i
    for (let n = 0; n < layers.length; n++) layers[n].classList.toggle('is-active', n === i)
    for (let n = 0; n < ticks.length; n++) ticks[n].classList.toggle('is-active', n === i)
    if (nowEl) nowEl.textContent = services[i].index || pad(i + 1)
    if (rail) rail.style.setProperty('--sl-accent', ACCENT[services[i].accent] || 'var(--accent)')
  }
  setActive(0)

  /* Reduced motion: the stacked card list is already the complete, legible
     state — no pin, no 3D, no scrubbing. */
  if (ctx.reduced) return

  const mm = gsap.matchMedia(root)

  /* ==================================================================== */
  /*  DESKTOP — pinned 3D layer transformation                            */
  /* ==================================================================== */
  mm.add(DESKTOP, () => {
    const pin = qs('[data-sl-pin]', root)
    if (!pin) return

    root.classList.add('is-3d')

    /* Opening state: three sheets almost coincident, tipped away slightly. */
    layers.forEach((layer, i) => {
      gsap.set(layer, { y: -13 * i, z: -36 * i, rotateX: 7, transformOrigin: '50% 50%' })
      gsap.set(veils[i], { opacity: i === 0 ? 0.16 : 0.34 + 0.12 * i })
      gsap.set(grids[i], { opacity: 0 })
      gsap.set(bodyKids[i], { y: 20, opacity: 0 })
      gsap.set(plates[i], { yPercent: -7 })
    })

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } })

    /** Move every sheet to its pose for `next` being the active layer. */
    const pose = (next, dur, start) => {
      layers.forEach((layer, i) => {
        const p = poseFor(i - next)
        const isNext = i === next

        tl.to(layer, { y: p.y, z: p.z, rotateX: p.rot, duration: dur }, start)
        tl.to(veils[i], { opacity: p.veil, duration: dur, ease: 'power1.inOut' }, start)

        if (isNext) {
          tl.to(grids[i], { opacity: 1, duration: dur * 0.55, ease: 'power1.inOut' }, start + dur * 0.38)
          tl.to(
            bodyKids[i],
            { y: 0, opacity: 1, duration: dur * 0.45, stagger: dur * 0.05, ease: 'power2.out' },
            start + dur * 0.44
          )
        } else {
          tl.to(grids[i], { opacity: 0, duration: dur * 0.4, ease: 'power1.inOut' }, start)
          tl.to(bodyKids[i], { y: -12, opacity: 0, duration: dur * 0.3, ease: 'power1.in' }, start)
        }
      })
    }

    /* --- assemble the master timeline ------------------------------- */
    const marks = []      // timeline time at which each layer rests
    const bounds = [0]    // timeline time at which the active layer changes
    let at = 0

    pose(0, FAN, 0)
    at = FAN
    marks[0] = at + HOLD * 0.5
    at += HOLD

    for (let i = 1; i < total; i++) {
      bounds[i] = at + MOVE * 0.5
      pose(i, MOVE, at)
      at += MOVE
      if (i < total - 1) {
        marks[i] = at + HOLD * 0.5
        at += HOLD
      } else {
        at += TAIL
        marks[i] = at - TAIL * 0.55
      }
    }

    /* Plates drift inside their frames for the whole pin, and the rail fill
       draws down. Both run at position 0 with the full length, so they also
       define the timeline's total duration. */
    plates.forEach((p) => tl.to(p, { yPercent: 7, duration: at, ease: 'none' }, 0))
    if (fill) tl.fromTo(fill, { scaleY: 0 }, { scaleY: 1, duration: at, ease: 'none' }, 0)

    const span = tl.duration() || at
    const restAt = marks.map((m) => m / span)
    const changeAt = bounds.map((b) => (b == null ? 0 : b / span))

    ticks.forEach((tick, i) => {
      if (restAt[i] != null) tick.style.top = `${(restAt[i] * 100).toFixed(3)}%`
    })

    /* --- one pinned, scrubbed, snapping ScrollTrigger ---------------- */
    const st = ScrollTrigger.create({
      animation: tl,
      trigger: pin,
      pin,
      start: 'top top',
      end: () => '+=' + Math.round(window.innerHeight * (0.55 + 0.65 * total)),
      scrub: 0.85,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      snap: {
        snapTo: [0, ...restAt, 1],
        duration: { min: 0.2, max: 0.65 },
        delay: 0.07,
        ease: 'power2.inOut',
      },
      onToggle: (self) => root.classList.toggle('is-live', self.isActive),
      onUpdate: (self) => {
        const p = self.progress
        let idx = 0
        for (let i = 1; i < total; i++) if (p >= changeAt[i]) idx = i
        setActive(idx)
      },
    })

    /* Keyboard: focusing a sheet that is buried in the pile scrolls the
       timeline to that layer so the reader sees what they are on. */
    const onFocus = (event) => {
      const layer = event.currentTarget
      if (typeof layer.matches === 'function' && !layer.matches(':focus-visible')) return
      const i = Number(layer.dataset.index)
      if (!Number.isFinite(i) || i === active || restAt[i] == null) return
      const y = st.start + restAt[i] * (st.end - st.start)
      if (ctx.lenis) ctx.lenis.scrollTo(y, { duration: 0.9 })
      else window.scrollTo({ top: y, behavior: 'smooth' })
    }
    layers.forEach((layer) => layer.addEventListener('focus', onFocus))

    return () => {
      layers.forEach((layer) => layer.removeEventListener('focus', onFocus))
      root.classList.remove('is-3d', 'is-live')
      setActive(0)
    }
  })

  /* ==================================================================== */
  /*  BELOW 900px — three plain cards, revealed in sequence               */
  /* ==================================================================== */
  mm.add(STACKED, () => {
    layers.forEach((layer, i) => {
      gsap.from(layer, {
        y: 44,
        opacity: 0,
        duration: DUR.slow,
        ease: EASE.out,
        scrollTrigger: { trigger: layer, start: 'top 88%', once: true },
      })

      gsap.fromTo(
        plates[i],
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: 'none',
          scrollTrigger: { trigger: layer, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        }
      )

      const list = qs('.sl-layer__list', layer)
      const items = qsa('.sl-layer__list li', layer)
      if (list && items.length) {
        gsap.from(items, {
          opacity: 0,
          y: 12,
          duration: DUR.base,
          stagger: 0.035,
          ease: EASE.out,
          scrollTrigger: { trigger: list, start: 'top 92%', once: true },
        })
      }
    })
  })
}
