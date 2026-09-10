/* ============================================================================
   APPLICATION BOOTSTRAP
   Every page entry calls boot() with its section initialisers. Boot order is
   fixed and deliberate:

     1. environment flags on <html>      (so CSS can branch before paint)
     2. smooth scroll                    (Lenis on the GSAP ticker)
     3. WebGL stage                      (shared renderer)
     4. chrome: cursor, nav, transitions
     5. section initialisers             (each may create 3D slots + triggers)
     6. preloader intro                  (unlocks scroll, emits 'intro:done')
     7. declarative reveals              (after layout has fully settled)
   ========================================================================== */
import { gsap, ScrollTrigger } from './motion.js'
import { initScroll, stopScroll, startScroll, resetScrollLock } from './scroll.js'
import { initReveals } from './reveal.js'
import { stage } from './webgl/stage.js'
import { initCursor } from './cursor.js'
import { initNav } from './nav.js'
import { initPreloader } from './preloader.js'
import { initTransitions } from './transition.js'
import { initUI } from '../ui/index.js'
import { initAmbient } from '../ui/ambient.js'
import { prefersReducedMotion, isTouch, deviceTier, debounce } from '../lib/utils.js'

/* ------------------------------------------------------------- EVENT BUS */
const listeners = new Map()

export const bus = {
  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set())
    listeners.get(evt).add(fn)
    return () => bus.off(evt, fn)
  },
  off(evt, fn) {
    listeners.get(evt)?.delete(fn)
  },
  emit(evt, payload) {
    listeners.get(evt)?.forEach((fn) => {
      try {
        fn(payload)
      } catch (err) {
        console.error(`[bus:${evt}]`, err)
      }
    })
  },
  /** Resolves immediately if the event already fired once. */
  once(evt, fn) {
    const off = bus.on(evt, (p) => {
      off()
      fn(p)
    })
    return off
  },
}

const fired = new Set()
const origEmit = bus.emit
bus.emit = (evt, payload) => {
  fired.add(evt)
  origEmit(evt, payload)
}
bus.hasFired = (evt) => fired.has(evt)

/* -------------------------------------------------------- SECTION MOUNTING */

const EAGER_MARGIN = 1.25 // viewports below the fold that still boot eagerly
const LAZY_MARGIN = '140% 0px 140% 0px'

function runInit(fn, ctx, slug) {
  try {
    fn(ctx)
  } catch (err) {
    console.error('[section]', slug || fn.name || 'anonymous', err)
  }
}

/**
 * Accepts either a bare init function or a [slug, init] pair. Pairs get the
 * lazy treatment; bare functions always run immediately, so older call sites
 * and section-less pages keep working.
 */
function mountSections(sections, ctx) {
  const deferred = []

  for (const entry of sections) {
    const [slug, fn] = Array.isArray(entry) ? entry : [null, entry]
    if (typeof fn !== 'function') continue

    const el = slug ? document.querySelector(`[data-section="${slug}"]`) : null
    if (!el) {
      // No matching markup on this page — the init will bail out on its own.
      runInit(fn, ctx, slug)
      continue
    }

    const top = el.getBoundingClientRect().top
    if (top < window.innerHeight * EAGER_MARGIN) {
      runInit(fn, ctx, slug)
    } else {
      deferred.push({ el, fn, slug })
    }
  }

  if (!deferred.length) return

  const refresh = debounce(() => ScrollTrigger.refresh(), 180)

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const item = deferred.find((d) => d.el === e.target)
        io.unobserve(e.target)
        if (!item) continue
        runInit(item.fn, ctx, item.slug)
        // The section may have rendered its markup only now, so wire the
        // declarative reveals inside it before it reaches the viewport.
        initReveals(item.el)
        initAmbient(item.el)
        refresh()
      }
    },
    { rootMargin: LAZY_MARGIN }
  )

  deferred.forEach((d) => io.observe(d.el))
}

/* ------------------------------------------------------------------ BOOT */

let ctx = null

/**
 * @param {object} options
 * @param {string} options.page      page identifier, e.g. 'home'
 * @param {Array<Function>} options.sections  section initialisers
 * @param {boolean} [options.preload=true]    show the intro loader
 */
export async function boot({ page = 'home', sections = [], preload = true } = {}) {
  const root = document.documentElement
  const reduced = prefersReducedMotion()
  const touch = isTouch()
  const tier = deviceTier()

  root.classList.remove('no-js')
  root.classList.add('js', `page-${page}`, `tier-${tier}`)
  root.classList.toggle('is-touch', touch)
  root.classList.toggle('reduced-motion', reduced)
  root.dataset.page = page

  // 1 — smooth scroll
  const lenis = initScroll()
  if (preload && !reduced) stopScroll()

  // 2 — WebGL
  stage.init()

  ctx = {
    page,
    lenis,
    stage,
    gsap,
    ScrollTrigger,
    bus,
    reduced,
    touch,
    tier,
  }

  // 3 — prime the loader FIRST so its minimum display time runs concurrently
  // with scene building and reveal wiring, instead of after it.
  const loader = initPreloader(ctx)

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    clearTimeout(failsafe)
    resetScrollLock()
    root.classList.add('is-ready')
    bus.emit('intro:done', ctx)
    ScrollTrigger.refresh()
  }

  // The loader's own ceiling only covers its exit animation, and it is armed
  // after setup runs. Arm an absolute deadline here, before the expensive
  // work, so a slow device can never strand a visitor behind the curtain.
  const failsafe = setTimeout(() => {
    document.querySelector('[data-preloader]')?.remove()
    finish()
  }, 8000)

  // 4 — chrome
  initTransitions(ctx)
  initNav(ctx)
  if (!touch && !reduced) initCursor(ctx)
  initUI(ctx)
  initAmbient(document)

  // 5 — sections.
  // Anything near the first screen boots immediately; everything below the
  // fold is initialised as it approaches. Building eleven sections and six
  // WebGL scenes up front costs seconds of time-to-interactive and most of
  // them are never seen in that first moment.
  mountSections(sections, ctx)

  // 6 — declarative reveals, once layout has settled
  await document.fonts?.ready?.catch(() => {})
  initReveals(document)
  ScrollTrigger.refresh()

  // 7 — intro
  if (preload && loader?.play) {
    loader.play().then(finish).catch(finish)
  } else {
    startScroll()
    finish()
  }

  // 8 — keep triggers honest through late layout shifts
  const refresh = debounce(() => ScrollTrigger.refresh(), 220)
  window.addEventListener('resize', refresh, { passive: true })
  window.addEventListener('orientationchange', () => setTimeout(refresh, 320))
  window.addEventListener('load', () => setTimeout(() => ScrollTrigger.refresh(), 120))

  // Restore scroll position at top on reload — pinned scenes expect it.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

  return ctx
}

export const getCtx = () => ctx
