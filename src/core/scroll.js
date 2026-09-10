/* ============================================================================
   SMOOTH SCROLL — Lenis driven by the GSAP ticker so that ScrollTrigger,
   WebGL and DOM animation all advance on one clock (zero desync / jitter).
   ========================================================================== */
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './motion.js'
import { prefersReducedMotion, isTouch } from '../lib/utils.js'

let lenis = null
let stopCount = 0

export function initScroll() {
  if (lenis) return lenis

  const reduced = prefersReducedMotion()

  lenis = new Lenis({
    duration: reduced ? 0 : 1.12,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: !reduced,
    syncTouch: false,
    touchMultiplier: 1.6,
    wheelMultiplier: 1.0,
    lerp: reduced ? 1 : 0.09,
    infinite: false,
    autoRaf: false,
    anchors: false,
    prevent: (node) => node.hasAttribute?.('data-lenis-prevent'),
  })

  // Keep ScrollTrigger perfectly in step with Lenis' virtual scroll.
  lenis.on('scroll', ScrollTrigger.update)

  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(220, 30)

  // Expose progress as a CSS variable for cheap, paint-only effects.
  lenis.on('scroll', ({ progress }) => {
    document.documentElement.style.setProperty('--scroll-progress', progress.toFixed(4))
  })

  // Anchor links route through Lenis for a smooth, eased jump.
  document.addEventListener('click', onAnchorClick, { passive: false })

  // Refresh once fonts settle — line wrapping shifts every trigger position.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh())
  }

  return lenis
}

function tick(time) {
  lenis?.raf(time * 1000)
}

function onAnchorClick(e) {
  const link = e.target.closest?.('a[href^="#"]')
  if (!link) return
  const id = link.getAttribute('href')
  if (!id || id === '#' || link.hasAttribute('data-no-scroll')) return
  const target = document.querySelector(id)
  if (!target) return
  e.preventDefault()
  scrollTo(target, { offset: -Math.round(window.innerHeight * 0.02) })
}

/* ------------------------------------------------------------------- API */

export const getLenis = () => lenis

export function scrollTo(target, opts = {}) {
  if (!lenis) {
    const node = typeof target === 'string' ? document.querySelector(target) : target
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  lenis.scrollTo(target, {
    offset: 0,
    duration: 1.4,
    easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    ...opts,
  })
}

/** Reference-counted stop, so overlapping locks (menu + modal) behave. */
export function stopScroll() {
  stopCount += 1
  if (stopCount === 1) {
    lenis?.stop()
    document.documentElement.classList.add('is-scroll-locked')
    if (isTouch()) document.body.style.overflow = 'hidden'
  }
}

export function startScroll() {
  stopCount = Math.max(0, stopCount - 1)
  if (stopCount === 0) {
    lenis?.start()
    document.documentElement.classList.remove('is-scroll-locked')
    document.body.style.overflow = ''
  }
}

export function resetScrollLock() {
  stopCount = 0
  lenis?.start()
  document.documentElement.classList.remove('is-scroll-locked')
  document.body.style.overflow = ''
}

/** Current smoothed scroll position. */
export const scrollY = () => lenis?.scroll ?? window.scrollY

/** Signed scroll velocity — sections use it to skew / bend on fast scroll. */
export const scrollVelocity = () => lenis?.velocity ?? 0
