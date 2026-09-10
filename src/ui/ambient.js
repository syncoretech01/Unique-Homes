/* ============================================================================
   AMBIENT MOTION — Motion One (WAAPI)

   Continuous, scroll-independent micro-motion: a live status dot breathing, a
   map pin pulsing, a scroll cue drifting. These loops never stop, so running
   them on the GSAP ticker would mean they compete every frame with Lenis and
   the WebGL stage — and stutter exactly when the 3D is busiest.

   Motion One's mini build (WAAPI only, ~3KB gzipped) compiles them to the Web
   Animations API instead, where the compositor owns them. They keep perfect
   time even while the main thread is saturated, and cost nothing per frame.

   Opt in from markup:
     data-pulse            soft opacity + scale breathing
     data-pulse="glow"     halo that expands and fades outward
     data-pulse="drift"    slow vertical drift
     data-pulse-duration   seconds (default 2.4)
     data-pulse-delay      seconds
   ========================================================================== */
import { animate } from 'motion/mini'
import { qsa, dataNum, prefersReducedMotion } from '../lib/utils.js'

const RUNNING = new WeakSet()

const PRESETS = {
  pulse: {
    keyframes: { opacity: [0.45, 1, 0.45], scale: [0.86, 1.06, 0.86] },
    easing: 'ease-in-out',
  },
  glow: {
    keyframes: { opacity: [0.55, 0, 0.55], scale: [0.7, 2.3, 0.7] },
    easing: 'ease-out',
  },
  drift: {
    keyframes: { transform: ['translateY(0px)', 'translateY(6px)', 'translateY(0px)'] },
    easing: 'ease-in-out',
  },
}

/**
 * Start every declared ambient loop inside `root`. Safe to call repeatedly —
 * elements already running are skipped.
 */
export function initAmbient(root = document) {
  if (prefersReducedMotion()) return

  qsa('[data-pulse]', root).forEach((el) => {
    if (RUNNING.has(el)) return
    RUNNING.add(el)

    const kind = el.dataset.pulse || 'pulse'
    const preset = PRESETS[kind] || PRESETS.pulse

    try {
      animate(el, preset.keyframes, {
        duration: dataNum(el, 'pulseDuration', 2.4),
        delay: dataNum(el, 'pulseDelay', 0),
        repeat: Infinity,
        easing: preset.easing,
      })
    } catch (err) {
      // A browser without WAAPI keeps the element in its resting state, which
      // is already the correct static design — nothing to fall back to.
      console.warn('[ambient] skipped', err)
    }
  })
}
