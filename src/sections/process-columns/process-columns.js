/* ============================================================================
   PROCESS COLUMNS
   The six-step process as a counter-rotating field of vertical columns.

   Wide viewports get a sticky stage: three columns of cards travel against
   each other as the page scrolls (1 and 3 up, 2 down, each at its own rate)
   while a fixed centred panel swaps through the six steps with a masked
   in/out. A hairline rail beside the panel tracks progress and lets a
   keyboard user jump to any step.

   Below 900px — and for anyone who asked for reduced motion — the same markup
   reads as a plain numbered list of the six steps. No column field is built at
   all, so phones never pay for the artwork.
   ========================================================================== */
import './process-columns.css'
import { gsap, ScrollTrigger, EASE } from '../../core/motion.js'
import { drawingSVG, grainDataURI } from '../../lib/drawings.js'
import { process as steps } from '../../data/content.js'
import { qsa, clamp } from '../../lib/utils.js'

/* ------------------------------------------------------------- CONSTANTS */

const KIND_POOL = ['plan', 'section', 'elevation', 'axon', 'site', 'framing', 'detail', 'contour', 'grid']

const COL_COUNT = 3
/** Times the six-step set is repeated down each column, so it never runs out. */
const SET_REPEAT = 2
/** Travel rate per column, as a fraction of the base distance. */
const COL_RATE = [1, 0.72, 0.88]
/** -1 travels up as the page scrolls down, +1 travels down. */
const COL_DIR = [-1, 1, -1]
/** Ambient breathing drift, px, paused while a card in that column is hovered. */
const DRIFT_AMP = [18, -24, 14]
const DRIFT_TIME = [17, 22, 19]
/** Base scroll travel, in multiples of the stage height. */
const TRAVEL_VH = 2.35
/** Only the middle column carries the focus falloff; the rest use the mask. */
const FOCUS_COL = 1

const TOTAL = steps.length

/* --------------------------------------------------------------- HELPERS */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/* ------------------------------------------------------------ THUMBNAILS */
/* One deterministic drawing per (column, step) — eighteen plates, each held
   once as a url() on the section root and referenced by every card that uses
   it, so the duplicated set costs nothing extra. Drawing all eighteen takes
   roughly 40ms, which is far too much to spend during boot, so they are built
   a few at a time in idle slices once the section is within a screen of the
   viewport. Until a plate lands its card shows the tinted ground. */

const PLATE_COUNT = COL_COUNT * TOTAL
const plateCache = []

function plateURL(idx, ink, accent) {
  if (plateCache[idx]) return plateCache[idx]
  const c = Math.floor(idx / TOTAL)
  const i = idx % TOTAL
  const svg = drawingSVG(KIND_POOL[(i * COL_COUNT + c) % KIND_POOL.length], {
    seed: 1201 + i * 17 + c * 103,
    ink,
    accent,
    width: 420,
    height: 280,
    density: 0.55,
    strokeScale: 0.85,
    showTitleBlock: false,
  })
  plateCache[idx] = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
  return plateCache[idx]
}

const idleSlice =
  typeof window.requestIdleCallback === 'function'
    ? (fn) => window.requestIdleCallback(fn, { timeout: 400 })
    : (fn) => window.setTimeout(fn, 24)

function buildPlates(root, signal) {
  const cs = getComputedStyle(root)
  const read = (name, fallback) => cs.getPropertyValue(name).trim() || fallback
  const ink = read('--c-blueprint', '#27415A')
  const accent = read('--c-terra', '#AE4E2A')

  let n = 0
  const slice = () => {
    if (signal.aborted) return
    const t0 = performance.now()
    do {
      root.style.setProperty(`--pc-img-${n}`, plateURL(n, ink, accent))
      n += 1
    } while (n < PLATE_COUNT && performance.now() - t0 < 7)
    if (n < PLATE_COUNT) idleSlice(slice)
  }

  if (plateCache.length === PLATE_COUNT) {
    for (let i = 0; i < PLATE_COUNT; i += 1) root.style.setProperty(`--pc-img-${i}`, plateCache[i])
    return
  }
  idleSlice(slice)
}

/** Start plate generation once the section is within a screen of the fold. */
function schedulePlates(root, target, signal) {
  if (typeof IntersectionObserver !== 'function') {
    buildPlates(root, signal)
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      buildPlates(root, signal)
    },
    { rootMargin: '100% 0px' }
  )
  io.observe(target)
  signal.addEventListener('abort', () => io.disconnect(), { once: true })
}

/* ---------------------------------------------------------------- MARKUP */

function stepHTML(step, i) {
  const outputs = step.outputs
    .map(
      (o) =>
        `<li class="process-columns__mask"><span class="process-columns__mask-in">` +
        `<span class="tag">${esc(o)}</span></span></li>`
    )
    .join('')

  return (
    `<li class="process-columns__step${i === 0 ? ' is-active' : ''}" data-pc-step="${i}">` +
    `<div class="process-columns__mask">` +
    `<span class="process-columns__mask-in process-columns__top-row">` +
    `<span class="process-columns__num">${esc(step.index)}</span>` +
    `<span class="process-columns__dur t-mono">${esc(step.duration)}</span>` +
    `</span></div>` +
    `<div class="process-columns__mask process-columns__mask--title">` +
    `<h3 class="process-columns__mask-in process-columns__title t-h3">${esc(step.title)}</h3>` +
    `</div>` +
    `<div class="process-columns__step-rule" aria-hidden="true"></div>` +
    `<div class="process-columns__mask">` +
    `<p class="process-columns__mask-in process-columns__summary t-lead">${esc(step.summary)}</p>` +
    `</div>` +
    `<div class="process-columns__mask process-columns__mask--detail">` +
    `<p class="process-columns__mask-in process-columns__detail t-body">${esc(step.detail)}</p>` +
    `</div>` +
    `<div class="process-columns__out">` +
    `<div class="process-columns__mask process-columns__mask--label">` +
    `<p class="process-columns__mask-in process-columns__out-label t-mono">Outputs</p>` +
    `</div>` +
    `<ul class="process-columns__outputs" role="list">${outputs}</ul>` +
    `</div></li>`
  )
}

function railHTML() {
  const ticks = steps
    .map(
      (s, i) =>
        `<button type="button" class="process-columns__tick${i === 0 ? ' is-active' : ''}"` +
        ` data-pc-tick="${i}"${i === 0 ? ' aria-current="true"' : ''}` +
        ` aria-label="Step ${esc(s.index)}, ${esc(s.title)}">` +
        `<span class="process-columns__tick-num" aria-hidden="true">${esc(s.index)}</span>` +
        `<span class="process-columns__tick-bar" aria-hidden="true"></span>` +
        `</button>`
    )
    .join('')

  return (
    `<span class="process-columns__rail-line" aria-hidden="true"></span>` +
    `<span class="process-columns__rail-fill" data-pc-fill aria-hidden="true"></span>` +
    ticks
  )
}

function cardHTML(step, i, c) {
  const idx = c * TOTAL + i
  return (
    `<article class="process-columns__card">` +
    `<div class="process-columns__card-in">` +
    `<span class="process-columns__thumb" style="--pc-thumb:var(--pc-img-${idx})"></span>` +
    `<div class="process-columns__card-body">` +
    `<div class="process-columns__card-meta">` +
    `<span class="process-columns__card-idx t-mono">${esc(step.index)}</span>` +
    `<span class="process-columns__card-dur t-mono">${esc(step.duration)}</span>` +
    `</div>` +
    `<p class="process-columns__card-title">${esc(step.title)}</p>` +
    `</div></div></article>`
  )
}

function fieldHTML() {
  let html = ''
  for (let c = 0; c < COL_COUNT; c += 1) {
    let cards = ''
    for (let r = 0; r < SET_REPEAT; r += 1) {
      for (let i = 0; i < TOTAL; i += 1) cards += cardHTML(steps[i], i, c)
    }
    html +=
      `<div class="process-columns__col" data-col="${c}">` +
      `<div class="process-columns__track"><div class="process-columns__drift">${cards}</div></div>` +
      `</div>`
  }
  return html
}

/* ------------------------------------------------------------------ INIT */

export default function initProcessColumns(ctx = {}) {
  const root = document.querySelector('[data-section="process-columns"]')
  if (!root) return

  const scroller = root.querySelector('[data-pc-scroller]')
  const view = root.querySelector('[data-pc-view]')
  const field = root.querySelector('[data-pc-field]')
  const railEl = root.querySelector('[data-pc-rail]')
  const stepsEl = root.querySelector('[data-pc-steps]')
  if (!scroller || !view || !field || !railEl || !stepsEl) return

  stepsEl.innerHTML = steps.map(stepHTML).join('')
  railEl.innerHTML = railHTML()

  const stepEls = qsa('.process-columns__step', stepsEl)
  const tickEls = qsa('[data-pc-tick]', railEl)
  const fillEl = railEl.querySelector('[data-pc-fill]')
  const linesOf = (li) => qsa('.process-columns__mask-in', li)
  const ruleOf = (li) => li.querySelector('.process-columns__step-rule')
  const allLines = stepEls.flatMap(linesOf)
  const allRules = stepEls.map(ruleOf).filter(Boolean)

  // Reduced motion: the static numbered list is the whole section.
  if (ctx.reduced) return

  root.classList.add('is-live')

  const mm = gsap.matchMedia()

  /* ---------------------------------------------------------------------- */
  /*  LIVE — sticky stage, counter-scrolling columns, masked panel swaps     */
  /* ---------------------------------------------------------------------- */

  mm.add('(min-width: 900px)', () => {
    const ac = new AbortController()
    const listen = { signal: ac.signal }

    // The grain overlay multiplies over 36 thumbnails — worth it, but not on
    // the weakest devices.
    if (ctx.tier !== 'low') {
      root.style.setProperty('--pc-grain', `url("${grainDataURI(96, 0.5, 5)}")`)
    }
    field.innerHTML = fieldHTML()
    schedulePlates(root, scroller, ac.signal)

    const cols = qsa('.process-columns__col', field).map((el, i) => {
      const track = el.querySelector('.process-columns__track')
      const drift = el.querySelector('.process-columns__drift')
      return {
        el,
        track,
        drift,
        setY: gsap.quickSetter(track, 'y', 'px'),
        tween: gsap.to(drift, {
          y: DRIFT_AMP[i],
          duration: DRIFT_TIME[i],
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        }),
        travel: 0,
      }
    })
    cols.forEach((c, i) => c.tween.progress((i * 0.31) % 1))

    const setFill = gsap.quickSetter(fillEl, 'scaleY')
    gsap.set(fillEl, { transformOrigin: 'top center', scaleY: 0 })

    /* -- focus falloff on the middle column ----------------------------- */
    let viewH = view.clientHeight || 1
    let focusCards = []
    let focusCentres = []
    const lastScale = []
    const lastOpacity = []

    function applyFocus(y) {
      const half = viewH * 0.5
      const band = viewH * 0.62 || 1
      for (let i = 0; i < focusCards.length; i += 1) {
        const d = clamp(Math.abs(focusCentres[i] + y - half) / band, 0, 1)
        const f = 1 - d * d * (3 - 2 * d)
        const s = Math.round((0.952 + f * 0.052) * 1000) / 1000
        const o = Math.round((0.5 + f * 0.5) * 100) / 100
        if (s !== lastScale[i]) {
          focusCards[i].style.setProperty('--pc-scale', s)
          lastScale[i] = s
        }
        if (o !== lastOpacity[i]) {
          focusCards[i].style.setProperty('--pc-op', o)
          lastOpacity[i] = o
        }
      }
    }

    /* -- the panel swap -------------------------------------------------- */
    let active = -1
    let swapTl = null

    function activate(next, dir) {
      if (next === active || !stepEls[next]) return
      const prevLi = active >= 0 ? stepEls[active] : null
      const nextLi = stepEls[next]
      active = next

      tickEls.forEach((t, i) => {
        t.classList.toggle('is-active', i === next)
        t.classList.toggle('is-done', i < next)
        if (i === next) t.setAttribute('aria-current', 'true')
        else t.removeAttribute('aria-current')
      })

      if (prevLi) prevLi.classList.remove('is-active')
      nextLi.classList.add('is-active')

      const nextLines = linesOf(nextLi)
      if (swapTl) swapTl.kill()

      if (!prevLi) {
        gsap.set(allLines, { yPercent: 115 })
        gsap.set(allRules, { scaleX: 0, transformOrigin: 'left center' })
        gsap.set(nextLines, { yPercent: 0 })
        gsap.set(ruleOf(nextLi), { scaleX: 1 })
        return
      }

      const sign = dir >= 0 ? 1 : -1
      swapTl = gsap.timeline({ defaults: { overwrite: 'auto' } })
      swapTl
        .to(linesOf(prevLi), {
          yPercent: -115 * sign,
          duration: 0.38,
          stagger: 0.022,
          ease: 'power2.in',
        }, 0)
        .to(ruleOf(prevLi), { scaleX: 0, duration: 0.3, ease: 'power2.in' }, 0)
        .fromTo(
          nextLines,
          { yPercent: 115 * sign },
          { yPercent: 0, duration: 0.8, stagger: 0.042, ease: EASE.out },
          0.15
        )
        .fromTo(
          ruleOf(nextLi),
          { scaleX: 0 },
          { scaleX: 1, duration: 0.95, ease: EASE.out },
          0.2
        )
    }

    /* -- per-scroll render ------------------------------------------------ */
    function render(p, dir) {
      for (let i = 0; i < cols.length; i += 1) {
        const c = cols[i]
        const y = COL_DIR[i] < 0 ? -c.travel * p : -c.travel * (1 - p)
        c.setY(y)
        if (i === FOCUS_COL) applyFocus(y)
      }
      setFill(p)
      activate(clamp(Math.floor(p * TOTAL), 0, TOTAL - 1), dir)
    }

    let st = null

    function measure() {
      viewH = view.clientHeight || 1
      for (let i = 0; i < cols.length; i += 1) {
        const c = cols[i]
        const room = Math.max(0, c.drift.offsetHeight - viewH)
        c.travel = Math.min(room, viewH * TRAVEL_VH * COL_RATE[i])
      }
      focusCards = Array.from(cols[FOCUS_COL].drift.children)
      focusCentres = focusCards.map((el) => el.offsetTop + el.offsetHeight / 2)
      lastScale.length = 0
      lastOpacity.length = 0
      if (st) render(st.progress, 1)
    }

    st = ScrollTrigger.create({
      trigger: scroller,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onRefresh: measure,
      onUpdate: (self) => render(self.progress, self.direction),
      // Promote the tracks only while the field is actually moving.
      onToggle: (self) => field.classList.toggle('is-armed', self.isActive),
    })

    measure()

    /* -- hover: pause that column's drift, lift the card (CSS) ----------- */
    if (!ctx.touch) {
      const setDrift = (col, scale) => {
        if (col.drifting === scale) return
        col.drifting = scale
        gsap.to(col.tween, { timeScale: scale, duration: scale ? 0.7 : 0.45, overwrite: true })
      }

      cols.forEach((col) => {
        col.drifting = 1
        col.el.addEventListener(
          'pointerover',
          (e) => {
            if (e.target.closest && e.target.closest('.process-columns__card')) setDrift(col, 0)
          },
          listen
        )
        col.el.addEventListener(
          'pointerout',
          (e) => {
            const to = e.relatedTarget
            if (!to || !col.el.contains(to) || !to.closest('.process-columns__card')) setDrift(col, 1)
          },
          listen
        )
      })
    }

    /* -- rail ticks jump to their step ------------------------------------ */
    tickEls.forEach((tick, i) => {
      tick.addEventListener(
        'click',
        () => {
          if (!st) return
          const y = st.start + (st.end - st.start) * ((i + 0.5) / TOTAL)
          if (ctx.lenis) ctx.lenis.scrollTo(y, { duration: 1.2 })
          else window.scrollTo({ top: y, behavior: 'smooth' })
        },
        listen
      )
    })

    return () => {
      ac.abort()
      if (swapTl) swapTl.kill()
      cols.forEach((c) => c.tween.kill())
      field.classList.remove('is-armed')
      field.innerHTML = ''
      gsap.set(allLines, { clearProps: 'transform' })
      gsap.set(allRules, { clearProps: 'transform,transformOrigin' })
      gsap.set(fillEl, { clearProps: 'transform,transformOrigin' })
      tickEls.forEach((t, i) => {
        t.classList.toggle('is-active', i === 0)
        t.classList.remove('is-done')
        if (i === 0) t.setAttribute('aria-current', 'true')
        else t.removeAttribute('aria-current')
      })
      stepEls.forEach((li, i) => li.classList.toggle('is-active', i === 0))
    }
  })

  /* ---------------------------------------------------------------------- */
  /*  FLAT — the same six steps as a numbered list, revealed on entry        */
  /* ---------------------------------------------------------------------- */

  mm.add('(max-width: 899px)', () => {
    stepEls.forEach((li) => {
      gsap.from(linesOf(li), {
        yPercent: 112,
        duration: 0.9,
        stagger: 0.05,
        ease: EASE.out,
        scrollTrigger: { trigger: li, start: 'top 84%', once: true },
      })
      gsap.from(ruleOf(li), {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.05,
        ease: EASE.out,
        scrollTrigger: { trigger: li, start: 'top 84%', once: true },
      })
    })
  })
}
