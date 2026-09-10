/* ============================================================================
   PAGE TRANSITIONS
   A multi-panel curtain wipes in before navigation and out on arrival, so the
   multi-page site reads as one continuous, choreographed experience.
   ========================================================================== */
import { gsap, EASE } from './motion.js'
import { stopScroll } from './scroll.js'
import { prefersReducedMotion } from '../lib/utils.js'

const ROWS = 6
let veil = null
let panels = []
let navigating = false

function buildVeil() {
  veil = document.createElement('div')
  veil.className = 'veil'
  veil.style.setProperty('--veil-rows', ROWS)
  veil.setAttribute('aria-hidden', 'true')

  for (let i = 0; i < ROWS; i++) {
    const panel = document.createElement('div')
    panel.className = 'veil__panel'
    veil.appendChild(panel)
  }

  const mark = document.createElement('div')
  mark.className = 'veil__mark'
  mark.innerHTML = '<span>Unique Homes <em>&amp;</em> Design</span>'
  veil.appendChild(mark)

  document.body.appendChild(veil)
  panels = Array.from(veil.querySelectorAll('.veil__panel'))
  return { veil, mark }
}

export function initTransitions() {
  if (veil) return
  const { mark } = buildVeil()

  // Arrival: panels start covering, then lift away.
  const reduced = prefersReducedMotion()
  const fromCache = performance.getEntriesByType?.('navigation')?.[0]?.type === 'back_forward'

  if (reduced) {
    gsap.set(panels, { scaleY: 0 })
  } else {
    gsap.set(panels, { scaleY: 1, transformOrigin: 'top center' })
    gsap.set(mark, { opacity: 0 })

    const clear = () => {
      gsap.killTweensOf(panels)
      gsap.set(panels, { scaleY: 0, transformOrigin: 'bottom center' })
    }

    gsap.to(panels, {
      scaleY: 0,
      duration: fromCache ? 0.6 : 0.95,
      ease: EASE.inOut,
      stagger: { each: 0.055, from: 'start' },
      delay: 0.05,
      onComplete: clear,
    })

    // GSAP advances on frames, not wall-clock, and lagSmoothing caps the step.
    // On a device slow enough to drop to a few fps the curtain would linger for
    // seconds, so guarantee it is gone regardless of how the tween is faring.
    setTimeout(clear, 2600)
  }

  document.addEventListener('click', onClick, { capture: true })
  window.addEventListener('pageshow', (e) => {
    // Returning via bfcache — make sure the curtain is not left down.
    if (e.persisted) {
      navigating = false
      gsap.set(panels, { scaleY: 0, transformOrigin: 'bottom center' })
      gsap.set(mark, { opacity: 0 })
      veil.classList.remove('is-active')
    }
  })
}

function onClick(e) {
  if (navigating) return
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

  const link = e.target.closest?.('a[href]')
  if (!link) return
  if (link.target === '_blank' || link.hasAttribute('download') || link.hasAttribute('data-no-transition')) return

  const href = link.getAttribute('href')
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin) return
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return // same page — let anchor handling deal with it
  }

  e.preventDefault()
  navigate(url.href)
}

export function navigate(href) {
  if (navigating) return
  navigating = true
  stopScroll()
  veil.classList.add('is-active')

  if (prefersReducedMotion()) {
    window.location.href = href
    return
  }

  const mark = veil.querySelector('.veil__mark')
  gsap.set(panels, { transformOrigin: 'bottom center' })

  gsap
    .timeline({
      onComplete: () => {
        window.location.href = href
      },
    })
    .to(panels, {
      scaleY: 1,
      duration: 0.72,
      ease: EASE.inOut,
      stagger: { each: 0.05, from: 'end' },
    })
    .to(mark, { opacity: 1, duration: 0.4, ease: EASE.out }, '-=0.35')
    .to({}, { duration: 0.12 })
}
