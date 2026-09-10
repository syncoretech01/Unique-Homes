/* ============================================================================
   PRELOADER — the studio title sheet.

   Sequence: the counter climbs with an irregular, hand-drawn rhythm while the
   house section strokes itself in, the status line steps through four phases
   and the wordmark rises letter by letter. Once fonts, window load and a
   minimum display time have all settled the number snaps to 100, the type
   leaves upward and the sheet splits into six columns that scale away to the
   top, uncovering the page — the same visual language as `.veil` in core.css.

   Two deliberate structural choices:

   1. The intro starts at *module evaluation*, not at play(). app.js imports
      this module first but only calls initPreloader() after fonts and every
      section have initialised — up to a second later. Priming here means the
      loader animates from the earliest frame JavaScript can reach, and the
      minimum display time is measured from that moment rather than from a
      later, variable one.

   2. play() can never leave the site covered: a hard timeout resolves it and
      removes the element no matter what fails, and preloader.html carries a
      pure-CSS failsafe fade for the case where this module never runs at all.
   ========================================================================== */
import { gsap, DrawSVGPlugin, EASE } from './motion.js'
import { qs, qsa, clamp, prefersReducedMotion } from '../lib/utils.js'

/* ------------------------------------------------------------- TIMING ---- */
const MIN_MS = 1600   // never flash the loader — measured from prime()
const SOFT_MS = 2400  // stop waiting on fonts / window load — from prime()
const HARD_MS = 4500  // absolute ceiling for play() — from play()

/** DrawSVG is registered in motion.js; verify before relying on the property. */
const canDrawSVG = Boolean(
  DrawSVGPlugin && (gsap.plugins?.drawSVG || DrawSVGPlugin.name === 'drawSVG')
)

const state = {
  root: null,
  el: null,
  bus: null,
  reduced: false,
  intro: null,
  count: null,
  exit: null,
  progress: { p: 0 },
  setBar: () => {},
  lastShown: -1,
  lastEmit: -1,
  startedAt: 0,
  promise: null,
  resolve: null,
  hardTimer: 0,
  settled: false,
}

/* --------------------------------------------------------------- PAINT ---- */

/** Write the current progress to the counter, the rule and the bus. */
function render() {
  if (!state.el) return
  const p = clamp(state.progress.p, 0, 1)

  const shown = Math.round(p * 100)
  if (shown !== state.lastShown) {
    state.lastShown = shown
    if (state.el.num) state.el.num.textContent = String(shown).padStart(3, '0')
  }

  state.setBar(p)

  if (p >= 1 ? state.lastEmit < 1 : p - state.lastEmit >= 0.005) {
    state.lastEmit = p
    state.bus?.emit('preloader:progress', p)
  }
}

/* --------------------------------------------------------------- SETUP ---- */

/** Cache the DOM, freeze the resting state and start the intro. */
function prime() {
  if (state.root || state.settled) return Boolean(state.root)

  const root = qs('[data-preloader]')
  if (!root) return false

  state.root = root
  state.el = {
    panels: qsa('.preloader__panel', root),
    grid: qs('.preloader__grid', root),
    paths: qsa('.preloader__path', root),
    letters: qsa('.preloader__l', root),
    metas: qsa('.preloader__meta', root),
    house: qs('.preloader__house', root),
    status: qs('.preloader__status', root),
    statusTrack: qs('[data-preloader-status]', root),
    statusLines: qsa('.preloader__status-line', root),
    rule: qs('.preloader__rule', root),
    bar: qs('[data-preloader-bar]', root),
    count: qs('.preloader__count', root),
    num: qs('[data-preloader-num]', root),
  }

  state.reduced = prefersReducedMotion()
  state.startedAt = performance.now()

  // Hand GSAP the resting transforms explicitly. The stylesheet expresses them
  // as percentages, which survive a computed matrix only as pixels — setting
  // them here seeds the transform cache so the tweens interpolate the units we
  // actually authored.
  gsap.set(state.el.panels, { transformOrigin: 'top center', scaleY: 1 })
  gsap.set(state.el.bar, { transformOrigin: 'left center', scaleX: 0 })
  if (state.el.bar) state.setBar = gsap.quickSetter(state.el.bar, 'scaleX')

  if (state.reduced) {
    showStatic()
    return true
  }

  buildIntro()
  buildCount()
  return true
}

/** Reduced motion: the sheet is simply legible and complete, no choreography. */
function showStatic() {
  const e = state.el
  const steps = Math.max(1, e.statusLines.length)
  gsap.set([e.house, e.count, e.status, ...e.metas], { opacity: 1 })
  gsap.set(e.letters, { yPercent: 0 })
  gsap.set(e.statusTrack, { yPercent: -(100 / steps) * (steps - 1) })
  state.progress.p = 1
  render()
}

/** Wordmark, drawing, metadata and the status rotation. */
function buildIntro() {
  const e = state.el
  const steps = Math.max(1, e.statusLines.length)

  gsap.set(e.letters, { yPercent: 115 })
  if (canDrawSVG) gsap.set(e.paths, { drawSVG: '0% 0%' })

  const tl = gsap.timeline()

  tl.to(e.house, { opacity: 1, duration: 0.45, ease: 'none' }, 0)
    .fromTo(
      e.metas,
      { opacity: 0, y: 7 },
      { opacity: 1, y: 0, duration: 0.75, stagger: 0.07, ease: EASE.out },
      0.04
    )
    .to(e.letters, { yPercent: 0, duration: 0.95, stagger: 0.026, ease: EASE.out }, 0.08)
    .to([e.status, e.count], { opacity: 1, duration: 0.6, ease: 'none' }, 0.3)

  // The section drawing strokes itself in, member by member.
  if (canDrawSVG) {
    tl.to(
      e.paths,
      { drawSVG: '0% 100%', duration: 0.7, stagger: 0.036, ease: 'power1.inOut' },
      0.06
    )
  }

  // Status line steps: 'Setting out' → 'Drawing structure' → … → 'Rendering'.
  for (let i = 1; i < steps; i += 1) {
    tl.to(
      e.statusTrack,
      { yPercent: -(100 / steps) * i, duration: 0.5, ease: EASE.inOut },
      0.42 + (i - 1) * 0.54
    )
  }

  state.intro = tl
}

/**
 * The counter. Deliberately uneven — short bursts, small plateaus and one long
 * pull, so it reads like work being done rather than a linear tween.
 */
function buildCount() {
  const p = state.progress
  state.count = gsap
    .timeline({ defaults: { ease: 'none' }, onUpdate: render })
    .to(p, { p: 0.14, duration: 0.3, ease: 'power2.out' })
    .to(p, { p: 0.27, duration: 0.22, ease: 'power1.inOut' }, '+=0.08')
    .to(p, { p: 0.52, duration: 0.38, ease: 'power3.out' })
    .to(p, { p: 0.61, duration: 0.2, ease: 'power1.out' }, '+=0.1')
    .to(p, { p: 0.84, duration: 0.42, ease: 'power2.inOut' })
    .to(p, { p: 0.93, duration: 0.24, ease: 'power1.out' }, '+=0.06')
}

/* ---------------------------------------------------------- READY GATE ---- */

const elapsed = () => performance.now() - state.startedAt

/** Resolves once `ms` have passed since the loader was primed. */
const since = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms - elapsed())))

const whenFonts = () =>
  document.fonts?.ready ? document.fonts.ready.then(() => {}, () => {}) : Promise.resolve()

const whenLoaded = () =>
  document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((r) => window.addEventListener('load', () => r(), { once: true }))

/** Everything we would like to wait for, capped by a soft deadline. */
function gate() {
  const ready = Promise.all([
    whenFonts(),
    whenLoaded(),
    since(MIN_MS),
    state.count ? state.count.then(() => {}) : Promise.resolve(),
  ]).then(
    () => {},
    () => {}
  )
  return Promise.race([ready, since(SOFT_MS)])
}

/* ----------------------------------------------------------------- EXIT --- */

function runExit() {
  if (state.settled || state.exit || !state.el) return
  const e = state.el

  state.count?.kill()
  gsap.killTweensOf(state.progress)
  gsap.set(e.panels, { willChange: 'transform' })

  const tl = gsap.timeline({ onComplete: settle })

  // 1 — the number finishes its climb.
  tl.to(state.progress, { p: 1, duration: 0.34, ease: 'power2.out', onUpdate: render }, 0)

    // 2 — wordmark, counter and drawing leave upward.
    .to(
      [e.count, e.status],
      { yPercent: -115, opacity: 0, duration: 0.44, stagger: 0.06, ease: EASE.swift },
      0.4
    )
    .to(e.house, { opacity: 0, y: -12, duration: 0.42, ease: EASE.out }, 0.4)
    .to(e.letters, { yPercent: -118, duration: 0.5, stagger: 0.011, ease: EASE.out }, 0.42)
    .to(e.metas, { opacity: 0, y: -6, duration: 0.34, stagger: 0.04, ease: EASE.out }, 0.44)
    .to(e.grid, { opacity: 0, duration: 0.4, ease: 'none' }, 0.44)
    .to(
      e.rule,
      { scaleX: 0, opacity: 0, transformOrigin: 'right center', duration: 0.4, ease: EASE.inOut },
      0.46
    )

    // 3 — the sheet splits into columns and scales away to the top.
    .set(state.root, { backgroundColor: 'transparent' }, 0.98)
    .to(
      e.panels,
      { scaleY: 0, duration: 0.58, ease: EASE.inOut, stagger: { each: 0.042, from: 'start' } },
      0.98
    )

  state.exit = tl
}

/* ------------------------------------------------------------- TEARDOWN --- */

function destroy() {
  state.intro?.kill()
  state.count?.kill()
  state.exit?.kill()
  gsap.killTweensOf(state.progress)
  if (state.root) {
    gsap.killTweensOf(state.root)
    state.root.remove()
  }
  state.root = null
  state.el = null
  state.intro = null
  state.count = null
  state.exit = null
}

/** Single exit point — idempotent, always resolves play(). */
function settle() {
  if (state.settled) return
  state.settled = true
  clearTimeout(state.hardTimer)
  state.progress.p = 1
  render()
  destroy()
  const done = state.resolve
  state.resolve = null
  done?.()
}

/* ------------------------------------------------------------------ API --- */

function play() {
  if (state.promise) return state.promise

  state.promise = new Promise((resolve) => {
    state.resolve = resolve

    // Nothing may outlive this, whatever happens above.
    state.hardTimer = setTimeout(settle, HARD_MS)

    if (!state.root) {
      settle()
      return
    }

    if (state.reduced) {
      state.progress.p = 1
      render()
      gsap.to(state.root, { opacity: 0, duration: 0.2, ease: 'none', onComplete: settle })
      return
    }

    gate().then(runExit, runExit)
  })

  return state.promise
}

/**
 * @param {object} ctx application context — { bus, reduced, ... }
 * @returns {{ play: () => Promise<void> }}
 */
export function initPreloader(ctx = {}) {
  prime()
  state.bus = ctx.bus || null

  // The app's reduced-motion verdict wins over our own read of the query.
  if (ctx.reduced && !state.reduced && state.el) {
    state.reduced = true
    state.intro?.kill()
    state.count?.kill()
    showStatic()
  }

  // Publish whatever the counter has already reached to the freshly-wired bus
  // — everything emitted while priming ran had nowhere to go.
  state.lastEmit = -1
  render()

  // Insurance: if the page boots with `preload: false`, play() is never called
  // and the sheet must still come off when the app declares the intro done.
  ctx.bus?.once?.('intro:done', () => {
    if (!state.promise) settle()
  })

  return { play }
}

/* Start as early as the document allows — see the note at the top of the file. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => prime(), { once: true })
} else {
  prime()
}
