/* ============================================================================
   MOTION CORE — GSAP registration, house easing curves, global defaults.
   Import { gsap, ScrollTrigger, SplitText, ... } from here, never from 'gsap'
   directly, so plugin registration is guaranteed to have happened first.
   ========================================================================== */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { Observer } from 'gsap/Observer'
import { CustomEase } from 'gsap/CustomEase'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { Flip } from 'gsap/Flip'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { prefersReducedMotion } from '../lib/utils.js'

gsap.registerPlugin(
  ScrollTrigger,
  SplitText,
  Observer,
  CustomEase,
  Draggable,
  InertiaPlugin,
  DrawSVGPlugin,
  Flip,
  ScrollToPlugin
)

/* ------------------------------------------------------ HOUSE EASE CURVES */
CustomEase.create('uhd', '0.16, 1, 0.3, 1')            // signature ease-out
CustomEase.create('uhd-soft', '0.25, 1, 0.5, 1')
CustomEase.create('uhd-io', '0.76, 0, 0.24, 1')        // symmetrical in/out
CustomEase.create('uhd-swift', '0.62, 0.05, 0.01, 0.99')
CustomEase.create('uhd-drift', '0.33, 0, 0.06, 1')     // long, cinematic
CustomEase.create('uhd-back', '0.34, 1.42, 0.64, 1')   // gentle overshoot

export const EASE = {
  out: 'uhd',
  soft: 'uhd-soft',
  inOut: 'uhd-io',
  swift: 'uhd-swift',
  drift: 'uhd-drift',
  back: 'uhd-back',
  expo: 'expo.out',
  power4: 'power4.out',
}

export const DUR = {
  fast: 0.32,
  base: 0.62,
  slow: 1.0,
  slower: 1.5,
  cinematic: 2.2,
}

/* --------------------------------------------------------------- DEFAULTS */
gsap.defaults({ ease: EASE.out, duration: DUR.base })

gsap.config({ autoSleep: 60, nullTargetWarn: false, force3D: true })

ScrollTrigger.config({
  ignoreMobileResize: true,
  limitCallbacks: true,
})

// Recalculate only on real width changes — mobile URL-bar height changes
// must not thrash pinned sections.
ScrollTrigger.normalizeScroll(false)

/* ------------------------------------------------------------ MEDIA QUERY */
export const mm = gsap.matchMedia()

export const MQ = {
  desktop: '(min-width: 1101px)',
  tablet: '(min-width: 769px) and (max-width: 1100px)',
  mobile: '(max-width: 768px)',
  notMobile: '(min-width: 769px)',
  hover: '(hover: hover) and (pointer: fine)',
  motion: '(prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
}

/** True when we should run the full expressive motion layer. */
export const richMotion = () => !prefersReducedMotion()

/* ------------------------------------------------------- SPLIT TEXT UTILS */
const splitRegistry = new WeakMap()

/**
 * Split text safely and re-split on resize (fonts + fluid type change wrapping).
 * Returns the SplitText instance.
 *
 * @param {Element} node
 * @param {object} opts SplitText options — { type, mask, ... }
 */
export function splitText(node, opts = {}) {
  if (!node) return null
  if (splitRegistry.has(node)) splitRegistry.get(node).revert()
  const instance = SplitText.create(node, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'split-line',
    wordsClass: 'split-word',
    charsClass: 'split-char',
    autoSplit: true,
    reduceWhiteSpace: false,
    ...opts,
  })
  splitRegistry.set(node, instance)
  return instance
}

/* -------------------------------------------------------------- UTILITIES */

/** requestAnimationFrame-throttled ScrollTrigger refresh. */
let refreshQueued = false
export function queueRefresh() {
  if (refreshQueued) return
  refreshQueued = true
  requestAnimationFrame(() => {
    ScrollTrigger.refresh()
    refreshQueued = false
  })
}

/**
 * Standard scroll-triggered timeline factory used by every section, so that
 * trigger geometry and behaviour stay consistent site-wide.
 */
export function sceneTimeline(trigger, opts = {}) {
  return gsap.timeline({
    defaults: { ease: EASE.out, duration: DUR.base },
    scrollTrigger: {
      trigger,
      start: 'top 78%',
      once: true,
      ...opts,
    },
  })
}

export {
  gsap,
  ScrollTrigger,
  SplitText,
  Observer,
  CustomEase,
  Draggable,
  InertiaPlugin,
  DrawSVGPlugin,
  Flip,
  ScrollToPlugin,
}
