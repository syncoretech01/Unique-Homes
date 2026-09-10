/* ============================================================================
   SERVICE DETAIL — three deep service chapters
   ----------------------------------------------------------------------------
   The heart of the services page. Everything below is rendered from
   src/data/services.js, because all three chapters run the same machine on
   different data:

     · a full-width opener — a giant outlined index numeral that parallaxes
       against a two-line Fraunces title, plus the lede;
     · a two-column body — the left column sticks and holds the COLUMNS
       SLIDER, the right column scrolls through the body copy, the eight
       deliverables and the four facts;
     · THE COLUMNS SLIDER — four procedural drawing plates stacked in one
       frame. A single scrubbed ScrollTrigger per chapter drives a paused
       timeline: the spent plate drifts up and shrinks a touch while the next
       slides in from below and unclips upward, with an accent rule riding the
       clip edge. A monospaced 01/04 readout and a four-segment rail track it;
     · the deliverables list — a drawn hairline rule per row, a setting-out
       cross for a tick, indices in mono;
     · the process band — four steps hung off a datum line that draws across;
     · the facts table and a "Discuss <service>" close.

   Chapter surfaces come from service.theme: chapter 01 is light paper,
   chapter 02 is a blueprint surface, chapter 03 is dark ink. The drawing
   ink and accent handed to plateHTML() are picked to match, so the plates
   invert correctly on the dark chapter.

   Below 1000px gsap.matchMedia() reverts the whole sticky apparatus: the
   plates become a horizontally snapping row that still drives the readout,
   and the chapter reads as one linear sequence.
   ========================================================================== */

import './service-detail.css'
import { gsap, ScrollTrigger, EASE, DUR } from '../../core/motion.js'
import { qs, qsa, pad, clamp } from '../../lib/utils.js'
import { services } from '../../data/services.js'
import { plateHTML, blueprintBackgroundCSS, grainDataURI } from '../../lib/drawings.js'

/* ------------------------------------------------------------------------ */
/*  CONSTANTS                                                                */
/* ------------------------------------------------------------------------ */

const DESKTOP = '(min-width: 1000px)'
const COMPACT = '(max-width: 999px)'

/** Four drawings per service — the set a reader would actually be handed. */
const PLATE_KINDS = {
  'architectural-packages': ['framing', 'section', 'detail', 'plan'],
  'civil-engineering': ['site', 'contour', 'plan', 'grid'],
  '3d-renderings': ['axon', 'elevation', 'section', 'detail'],
}
const FALLBACK_KINDS = ['plan', 'section', 'elevation', 'detail']

const KIND_CAPTION = {
  plan: 'Floor plan',
  section: 'Wall section',
  elevation: 'Elevation study',
  axon: 'Cutaway axonometric',
  site: 'Site plan',
  framing: 'Framing plan',
  detail: 'Construction detail',
  contour: 'Existing contours',
  grid: 'Setting-out grid',
}

/* Artwork palettes per chapter surface. Hex is legal here and only here: it
   is fed to generated SVG, never to a stylesheet. */
const THEME_ART = {
  default: { a: '#F4F0E9', b: '#E3DBCA', ink: '#3B342B', accent: '#AE4E2A' },
  blueprint: { a: '#EAEFF3', b: '#D3DDE6', ink: '#27415A', accent: '#AE4E2A' },
  ink: { a: '#221E1A', b: '#131110', ink: '#D6CCBC', accent: '#C2934A' },
}

/** service.accent → the token that tints the chapter's rules, ticks and CTA. */
const ACCENT = {
  terra: 'var(--c-terra)',
  blueprint: 'var(--c-terra)',
  ochre: 'var(--c-ochre)',
}

/** Deterministic drawing seeds — the same sheets as the home-page stack. */
const SEED = {
  'architectural-packages': 41,
  'civil-engineering': 27,
  '3d-renderings': 63,
}

/* Slider beats, in arbitrary timeline units: a dwell on each plate and the
   handover between two. The chapter's whole sticky travel is mapped onto
   4 × HOLD + 3 × MOVE. */
const HOLD = 0.5
const MOVE = 1.25

/* ------------------------------------------------------------------------ */
/*  MARKUP                                                                   */
/* ------------------------------------------------------------------------ */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ESCAPES[c])

const TICK_SVG =
  '<svg class="sd-deliv__tick" viewBox="0 0 10 10" aria-hidden="true" focusable="false">' +
  '<path d="M5 0.7v8.6M0.7 5h8.6" fill="none" stroke="currentColor" stroke-width="1.1" ' +
  'stroke-linecap="square"/></svg>'

const WIRE_SVG =
  '<svg class="sd-process__wire" viewBox="0 0 1000 1" preserveAspectRatio="none" ' +
  'aria-hidden="true" focusable="false" data-sd-wire>' +
  '<line x1="0" y1="0.5" x2="1000" y2="0.5" stroke="currentColor" stroke-width="1" ' +
  'vector-effect="non-scaling-stroke"/></svg>'

function openerHTML(service, titleId) {
  const lines = String(service.title || service.label)
    .split('\n')
    .map(
      (line, n) =>
        `<span class="sd-open__line${n ? ' sd-open__line--b' : ''}">${esc(line)}</span>`
    )
    .join('')

  const facts = service.facts || []
  const meta = [facts[1], facts[0]]
    .filter(Boolean)
    .map((f) => `<span>${esc(f.k)} — ${esc(f.v)}</span>`)
    .join('')

  /* No eyebrow above the title: the numeral already gives the index and the
     title already gives the service name, so a label would only repeat one
     of the two. The counterweight is the lede + meta row beneath. */
  return (
    `<header class="sd-open">` +
      `<p class="sd-open__numeral" aria-hidden="true" data-sd-numeral ` +
        `data-parallax="-0.16" data-parallax-scope=".sd-open">${esc(service.index)}</p>` +
      `<div class="sd-open__head" data-parallax="0.05" data-parallax-scope=".sd-open">` +
        `<h2 class="sd-open__title" id="${esc(titleId)}" data-split="lines">${lines}</h2>` +
      `</div>` +
      `<div class="sd-open__aside">` +
        `<p class="t-lead sd-open__lede" data-reveal="up" data-delay="0.06">${esc(service.lede)}</p>` +
        `<p class="sd-open__meta" data-reveal="up" data-delay="0.16">${meta}</p>` +
      `</div>` +
    `</header>`
  )
}

function sliderHTML(service, kinds) {
  const plates = kinds
    .map(
      (kind, i) =>
        `<figure class="sd-plate" data-sd-plate data-index="${i}">` +
          `<div class="sd-plate__art" data-sd-art></div>` +
          `<figcaption class="sd-plate__cap u-sr">` +
            `${esc(KIND_CAPTION[kind] || kind)} — sheet ${esc(pad(i + 1))} of ${esc(pad(kinds.length))}` +
          `</figcaption>` +
        `</figure>`
    )
    .join('')

  const segs = kinds
    .map(() => `<li class="sd-hud__seg"><span class="sd-hud__seg-fill" data-sd-seg></span></li>`)
    .join('')

  return (
    `<div class="sd-visual">` +
      `<div class="sd-slider" data-sd-slider role="group" ` +
        `aria-label="Drawing plates — ${esc(service.label)}">` +
        plates +
        `<span class="sd-wipe" data-sd-wipe aria-hidden="true"></span>` +
      `</div>` +
      `<div class="sd-hud">` +
        `<div class="sd-hud__top">` +
          `<p class="sd-hud__count" aria-hidden="true">` +
            `<span class="sd-hud__now" data-sd-now>01</span>` +
            `<span class="sd-hud__slash">/</span>` +
            `<span class="sd-hud__total">${esc(pad(kinds.length))}</span>` +
          `</p>` +
          `<ol class="sd-hud__rail" aria-hidden="true">${segs}</ol>` +
        `</div>` +
        `<div class="sd-hud__bottom">` +
          `<p class="sd-hud__cap" data-sd-cap>` +
            `${esc(KIND_CAPTION[kinds[0]] || kinds[0])}</p>` +
          `<span class="sd-hud__hint sd-hud__hint--scroll" aria-hidden="true">Scroll</span>` +
          `<span class="sd-hud__hint sd-hud__hint--swipe" aria-hidden="true">Swipe</span>` +
        `</div>` +
      `</div>` +
    `</div>`
  )
}

function copyHTML(service) {
  const keys = (service.keywords || [])
    .map(
      (k) =>
        `<li class="tag sd-key"><span class="tag__dot" aria-hidden="true"></span>${esc(k)}</li>`
    )
    .join('')

  const deliverables = (service.deliverables || [])
    .map(
      (d, i) =>
        `<li class="sd-deliv__row">` +
          `<span class="sd-deliv__rule" data-sd-rule aria-hidden="true"></span>` +
          `<span class="sd-deliv__no" data-sd-no>${esc(pad(i + 1))}</span>` +
          `<span class="sd-deliv__text" data-sd-text>${esc(d)}</span>` +
          TICK_SVG +
        `</li>`
    )
    .join('')

  const facts = (service.facts || [])
    .map(
      (f) =>
        `<tr><th scope="row">${esc(f.k)}</th><td>${esc(f.v)}</td></tr>`
    )
    .join('')

  return (
    `<div class="sd-copy">` +
      `<p class="sd-copy__body" data-reveal="up">${esc(service.body)}</p>` +

      `<ul class="sd-copy__keys" data-reveal-group data-stagger="0.05">${keys}</ul>` +

      `<div class="sd-block sd-deliv">` +
        `<div class="sd-block__head">` +
          `<span class="eyebrow">Deliverables</span>` +
          `<span class="sd-block__count">${esc(pad((service.deliverables || []).length))}</span>` +
        `</div>` +
        `<ol class="sd-deliv__list" data-sd-deliv>${deliverables}</ol>` +
      `</div>` +

      `<div class="sd-block sd-facts">` +
        `<div class="sd-block__head">` +
          `<span class="eyebrow">Key facts</span>` +
        `</div>` +
        `<table class="sd-facts__table" data-reveal="up" data-start="top 88%">` +
          `<caption class="u-sr">Key facts — ${esc(service.label)}</caption>` +
          `<tbody>${facts}</tbody>` +
        `</table>` +
      `</div>` +
    `</div>`
  )
}

function processHTML(service) {
  const steps = (service.process || [])
    .map(
      (p, i) =>
        `<li class="sd-step">` +
          `<span class="sd-step__mark" data-sd-dot aria-hidden="true">` +
            `<span class="sd-step__diamond"></span></span>` +
          `<span class="sd-step__no">${esc(pad(i + 1))}</span>` +
          `<h3 class="sd-step__name">${esc(p.step)}</h3>` +
          `<p class="sd-step__note">${esc(p.note)}</p>` +
        `</li>`
    )
    .join('')

  const count = (service.process || []).length

  return (
    `<div class="sd-process">` +
      `<div class="sd-process__head">` +
        `<span class="eyebrow">How it runs</span>` +
        `<span class="sd-process__note">${esc(count)} stages</span>` +
      `</div>` +
      `<div class="sd-process__band" data-sd-steps>` +
        WIRE_SVG +
        `<ol class="sd-process__steps">${steps}</ol>` +
      `</div>` +
    `</div>`
  )
}

function footHTML(service, total) {
  return (
    `<div class="sd-foot" data-reveal="up" data-start="top 90%">` +
      `<span class="sd-foot__lead">` +
        `<span class="eyebrow sd-foot__label">Next step</span>` +
        `<span class="sd-foot__ref">Service ${esc(service.index)} of ${esc(pad(total))}</span>` +
      `</span>` +
      `<a class="btn btn--ghost sd-foot__cta" href="/contact/" data-arrow data-magnetic>` +
        `Discuss ${esc(service.label)}</a>` +
    `</div>`
  )
}

function chapterHTML(service, index, total) {
  const theme = THEME_ART[service.theme] ? service.theme : 'default'
  const accent = ACCENT[service.accent] || 'var(--accent)'
  const kinds = PLATE_KINDS[service.id] || FALLBACK_KINDS
  const titleId = `sd-title-${service.id}`
  const themeAttr = theme === 'default' ? '' : ` data-theme="${theme}"`

  return (
    `<article class="sd-chapter" id="${esc(service.id)}" data-sd-chapter ` +
      `data-sd-theme="${theme}" data-index="${index}"${themeAttr} ` +
      `style="--sd-accent:${accent}" aria-labelledby="${esc(titleId)}">` +
      `<div class="sd-chapter__field" data-sd-field aria-hidden="true"></div>` +
      `<div class="sd-chapter__glow" aria-hidden="true"></div>` +
      `<div class="shell sd-chapter__inner">` +
        `<span class="sd-chapter__hair" data-reveal="mask" aria-hidden="true"></span>` +
        openerHTML(service, titleId) +
        `<div class="sd-body" data-sd-body>` +
          sliderHTML(service, kinds) +
          copyHTML(service) +
        `</div>` +
        processHTML(service) +
        footHTML(service, total) +
      `</div>` +
    `</article>`
  )
}

/* ------------------------------------------------------------------------ */
/*  PLATES                                                                   */
/* ------------------------------------------------------------------------ */

/** Render one procedural drawing into its holder. Idempotent. */
function mountPlate(model, i) {
  const holder = model.arts[i]
  if (!holder || holder.dataset.mounted === '1') return
  holder.dataset.mounted = '1'
  holder.innerHTML = plateHTML(
    {
      kind: model.kinds[i],
      a: model.art.a,
      b: model.art.b,
      ink: model.art.ink,
      accent: model.art.accent,
      seed: model.seed + i * 7,
    },
    {
      width: 760,
      height: 950,
      density: 0.95,
      strokeScale: 0.9,
      showTitleBlock: false,
    }
  )
}

/** Paint the chapter's texture field from generated values. */
function paintField(chapter) {
  const field = qs('[data-sd-field]', chapter)
  if (!field) return
  const theme = chapter.dataset.sdTheme
  if (theme === 'blueprint') {
    field.style.backgroundImage = blueprintBackgroundCSS({ size: 30, major: 4, thickness: 1 })
    return
  }
  field.style.backgroundImage = `url(${grainDataURI(96, theme === 'ink' ? 0.4 : 0.52, 5)})`
}

/* ------------------------------------------------------------------------ */
/*  CHAPTER MODEL                                                            */
/* ------------------------------------------------------------------------ */

function buildModel(chapter, service) {
  const kinds = PLATE_KINDS[service.id] || FALLBACK_KINDS
  const theme = THEME_ART[service.theme] ? service.theme : 'default'

  const plates = qsa('[data-sd-plate]', chapter)

  return {
    chapter,
    service,
    kinds,
    art: THEME_ART[theme],
    seed: SEED[service.id] || 11,
    count: plates.length,
    slider: qs('[data-sd-slider]', chapter),
    body: qs('[data-sd-body]', chapter),
    visual: qs('.sd-visual', chapter),
    plates,
    arts: plates.map((p) => qs('[data-sd-art]', p)),
    wipe: qs('[data-sd-wipe]', chapter),
    segs: qsa('[data-sd-seg]', chapter),
    nowEl: qs('[data-sd-now]', chapter),
    capEl: qs('[data-sd-cap]', chapter),
    active: -1,
  }
}

/** Move the readout to plate `i`. Cheap and idempotent. */
function setActive(model, i, reduced) {
  const next = clamp(i, 0, model.count - 1)
  if (next === model.active) return
  model.active = next

  if (model.nowEl) model.nowEl.textContent = pad(next + 1)

  const caption = KIND_CAPTION[model.kinds[next]] || model.kinds[next]
  if (model.capEl && model.capEl.textContent !== caption) {
    model.capEl.textContent = caption
    if (!reduced) {
      gsap.fromTo(
        model.capEl,
        { opacity: 0, y: 7 },
        { opacity: 1, y: 0, duration: DUR.fast, ease: EASE.out, overwrite: true }
      )
    }
  }
}

/* ------------------------------------------------------------------------ */
/*  INIT                                                                     */
/* ------------------------------------------------------------------------ */

export default function initServiceDetail(ctx = {}) {
  const root = document.querySelector('[data-section="service-detail"]')
  if (!root) return

  const mount = qs('[data-sd-chapters]', root)
  if (!mount || !services.length) return
  if (root.dataset.sdBuilt === '1') return
  root.dataset.sdBuilt = '1'

  const reduced = !!ctx.reduced
  const total = services.length

  /* ---------------------------------------------------------- render */
  mount.innerHTML = services.map((s, i) => chapterHTML(s, i, total)).join('')

  const chapters = qsa('[data-sd-chapter]', mount)
  if (!chapters.length) return

  if (reduced) root.classList.add('is-static')

  chapters.forEach(paintField)

  const models = chapters.map((chapter, i) => buildModel(chapter, services[i]))

  /* ------------------------------------------------------ plate mounting
     The first plate of every chapter is drawn immediately so the section is
     never blank; the other nine are generated as their chapter approaches. */
  models.forEach((model) => {
    if (!model.count) return
    mountPlate(model, 0)
    setActive(model, 0, true)

    const rest = () => {
      for (let i = 1; i < model.count; i++) mountPlate(model, i)
    }

    if (reduced) {
      rest()
      return
    }
    ScrollTrigger.create({
      trigger: model.chapter,
      start: 'top bottom+=40%',
      once: true,
      onEnter: rest,
    })
  })

  /* Reduced motion: the static grid of plates, the ruled list and the table
     are already the complete, legible chapter. Nothing else to do. */
  if (reduced) return

  /* --------------------------------------------------- deliverables list
     One timeline per list: the hairline rule draws, the label wipes in from
     the left, the index fades up and the setting-out cross snaps in. */
  models.forEach((model) => {
    const list = qs('[data-sd-deliv]', model.chapter)
    if (!list) return

    const rules = qsa('[data-sd-rule]', list)
    const nums = qsa('[data-sd-no]', list)
    const texts = qsa('[data-sd-text]', list)
    const ticks = qsa('.sd-deliv__tick', list)
    if (!rules.length) return

    const tl = gsap.timeline({
      scrollTrigger: { trigger: list, start: 'top 84%', once: true },
    })
    tl.fromTo(
      rules,
      { scaleX: 0 },
      { scaleX: 1, duration: 0.9, stagger: 0.07, ease: EASE.out },
      0
    )
    tl.fromTo(
      texts,
      { clipPath: 'inset(-12% 100% -12% 0%)' },
      { clipPath: 'inset(-12% -3% -12% 0%)', duration: 0.85, stagger: 0.07, ease: EASE.out },
      0.07
    )
    tl.fromTo(
      nums,
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.5, stagger: 0.07, ease: EASE.out },
      0.1
    )
    /* clearProps hands the tick back to CSS so its hover transform wins. */
    tl.fromTo(
      ticks,
      { scale: 0, rotate: -70, opacity: 0 },
      {
        scale: 1,
        rotate: 0,
        opacity: 0.55,
        duration: 0.5,
        stagger: 0.07,
        ease: EASE.back,
        clearProps: 'transform,opacity',
      },
      0.22
    )
  })

  /* ------------------------------------------------------- process band
     The datum line draws across and each diamond lands as the line reaches
     it. Below 1000px the wire is hidden and the steps simply rise. */
  models.forEach((model) => {
    const steps = qs('[data-sd-steps]', model.chapter)
    if (!steps) return

    const wire = qs('[data-sd-wire] line', steps)
    const dots = qsa('[data-sd-dot]', steps)
    const items = qsa('.sd-step', steps)
    if (!items.length) return

    const tl = gsap.timeline({
      scrollTrigger: { trigger: steps, start: 'top 82%', once: true },
    })

    if (wire) {
      tl.fromTo(wire, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.5, ease: EASE.soft }, 0)
    }
    tl.fromTo(
      dots,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.45, stagger: 0.32, ease: EASE.back },
      0.18
    )
    tl.fromTo(
      items,
      { y: 26, opacity: 0 },
      { y: 0, opacity: 1, duration: DUR.slow, stagger: 0.09, ease: EASE.out },
      0.1
    )
  })

  /* ==================================================================== */
  /*  MEDIA-DEPENDENT: the columns slider                                 */
  /* ==================================================================== */
  const mm = gsap.matchMedia(root)

  /* -------------------------------------------------- DESKTOP ≥ 1000px */
  mm.add(DESKTOP, () => {
    const kill = []

    models.forEach((model) => {
      const { plates, arts, wipe, segs, body, visual } = model
      const n = model.count
      if (n < 2 || !body || !visual) return

      /* Opening pose: plate 01 square in the frame, the rest waiting below,
         clipped away with their artwork held slightly oversized.

         The scale lives on the artwork, never on the plate box: the boxes
         stay exactly frame-width so that no seam of the empty frame can
         ever show between an outgoing sheet and the one arriving under it. */
      plates.forEach((plate, i) => {
        gsap.set(plate, {
          zIndex: i + 1,
          yPercent: i === 0 ? 0 : 26,
          clipPath: i === 0 ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)',
        })
        gsap.set(arts[i], { yPercent: i === 0 ? 0 : 6, scale: i === 0 ? 1 : 1.08 })
      })
      gsap.set(wipe, { yPercent: 2 })
      gsap.set(segs, { scaleX: 0 })

      /* ------------------------------------------ assemble the timeline */
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
      const arrive = []
      let at = 0

      for (let i = 0; i < n; i++) {
        arrive[i] = at
        at += HOLD
        if (i === n - 1) break

        const start = at
        const swap = { duration: MOVE, ease: 'power2.inOut' }

        tl.to(plates[i + 1], { yPercent: 0, clipPath: 'inset(0% 0% 0% 0%)', ...swap }, start)
        tl.to(arts[i + 1], { yPercent: 0, scale: 1, ...swap }, start)
        tl.to(plates[i], { yPercent: -15, ...swap }, start)
        tl.to(arts[i], { yPercent: -6, scale: 1.02, ...swap }, start)
        tl.fromTo(
          wipe,
          { yPercent: 2 },
          { yPercent: -102, immediateRender: false, ...swap },
          start
        )

        at += MOVE
      }

      for (let i = 0; i < n; i++) {
        const end = i < n - 1 ? arrive[i + 1] : at
        tl.fromTo(
          segs[i],
          { scaleX: 0 },
          { scaleX: 1, duration: Math.max(0.001, end - arrive[i]), immediateRender: false },
          arrive[i]
        )
      }

      const span = tl.duration() || at
      /* A plate owns the readout from the midpoint of the move that brings
         it in — that is the frame where it visually takes over. */
      const changeAt = arrive.map((a, i) => (i === 0 ? 0 : (a - MOVE * 0.5) / span))

      /* --------------------------------- one scrubbed trigger per chapter
         The scrub window is exactly the sticky column's travel: it opens the
         moment the visual pins itself and closes the moment it lets go. */
      const stickyTop = () => {
        const t = parseFloat(getComputedStyle(visual).top)
        return Number.isFinite(t) ? Math.round(t) : 0
      }

      const st = ScrollTrigger.create({
        animation: tl,
        trigger: body,
        start: () => `top ${stickyTop()}px`,
        end: () => `bottom ${stickyTop() + visual.offsetHeight}px`,
        scrub: 0.7,
        invalidateOnRefresh: true,
        onToggle: (self) => model.chapter.classList.toggle('is-live', self.isActive),
        onUpdate: (self) => {
          const p = self.progress
          let idx = 0
          for (let i = 1; i < n; i++) if (p >= changeAt[i]) idx = i
          setActive(model, idx, false)
        },
      })

      kill.push(() => {
        st.kill()
        tl.kill()
        model.chapter.classList.remove('is-live')
        model.active = -1
        setActive(model, 0, true)
      })
    })

    return () => kill.forEach((fn) => fn())
  })

  /* --------------------------------------------------- COMPACT < 1000px
     No sticky, no scrub: the plates are a native horizontally snapping row
     and the same readout follows the row's own scroll position. */
  mm.add(COMPACT, () => {
    const teardown = []

    models.forEach((model) => {
      const { slider, segs } = model
      const n = model.count
      if (!slider || n < 2) return

      let queued = false
      const read = () => {
        queued = false
        const max = slider.scrollWidth - slider.clientWidth
        const p = max > 4 ? clamp(slider.scrollLeft / max, 0, 1) : 0
        /* x is the fractional plate index the row is resting on. */
        const x = p * (n - 1)
        setActive(model, Math.round(x), false)
        for (let i = 0; i < segs.length; i++) {
          const fill = i === n - 1 ? (x >= n - 1.001 ? 1 : 0) : clamp(x - i, 0, 1)
          gsap.set(segs[i], { scaleX: fill })
        }
      }
      const onScroll = () => {
        if (queued) return
        queued = true
        requestAnimationFrame(read)
      }

      slider.addEventListener('scroll', onScroll, { passive: true })
      read()

      /* Plates rise as the chapter arrives, so the row is not a dead strip. */
      const intro = gsap.fromTo(
        model.plates,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: DUR.slow,
          stagger: 0.07,
          ease: EASE.out,
          scrollTrigger: { trigger: slider, start: 'top 88%', once: true },
        }
      )

      teardown.push(() => {
        slider.removeEventListener('scroll', onScroll)
        intro.scrollTrigger?.kill()
        intro.kill()
        model.active = -1
        setActive(model, 0, true)
      })
    })

    return () => teardown.forEach((fn) => fn())
  })
}
