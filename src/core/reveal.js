/* ============================================================================
   REVEAL ENGINE
   A declarative, attribute-driven entrance + parallax system. Sections never
   hand-write ScrollTriggers for ordinary reveals — they tag markup instead:

     data-reveal="up|fade|scale|clip|mask|blur"   element entrance
     data-split="lines|words|chars"               masked text entrance
     data-stagger="0.06"  data-delay="0.2"  data-start="top 82%"
     data-parallax="-0.18"        vertical parallax factor (of element height)
     data-parallax-x="0.1"        horizontal drift
     data-parallax-scale="1.12"   scale-through-viewport
     data-counter="240"           animated number count-up
     data-draw                    SVG stroke draw-on
     data-skew                    velocity-reactive skew

   Everything degrades to a static, fully-visible page when reduced motion is
   requested or JS fails.
   ========================================================================== */
import { gsap, ScrollTrigger, splitText, EASE, DUR } from './motion.js'
import { scrollVelocity } from './scroll.js'
import { qsa, dataNum, prefersReducedMotion, clamp } from '../lib/utils.js'

const DONE = new WeakSet()

/* ------------------------------------------------------------------------ */
/*  ELEMENT REVEALS                                                          */
/* ------------------------------------------------------------------------ */

const FROM = {
  up: { opacity: 0, y: '2.2rem' },
  down: { opacity: 0, y: '-2.2rem' },
  left: { opacity: 0, x: '-2.5rem' },
  right: { opacity: 0, x: '2.5rem' },
  fade: { opacity: 0 },
  scale: { opacity: 0, scale: 1.06 },
  'scale-down': { opacity: 0, scale: 0.94 },
  clip: { clipPath: 'inset(0 0 100% 0)' },
  mask: { clipPath: 'inset(0 100% 0 0)' },
  blur: { opacity: 0, filter: 'blur(14px)' },
}

const TO = {
  clip: { clipPath: 'inset(0 0 0% 0)' },
  mask: { clipPath: 'inset(0 0% 0 0)' },
  blur: { opacity: 1, filter: 'blur(0px)' },
}

function revealElements(root) {
  qsa('[data-reveal]', root).forEach((node) => {
    if (DONE.has(node)) return
    DONE.add(node)

    const kind = node.dataset.reveal || 'up'
    const from = FROM[kind] || FROM.up
    const to = TO[kind] || { opacity: 1, x: 0, y: 0, scale: 1 }

    gsap.set(node, from)

    gsap.to(node, {
      ...to,
      duration: dataNum(node, 'duration', kind === 'clip' || kind === 'mask' ? 1.15 : DUR.slow),
      delay: dataNum(node, 'delay', 0),
      ease: node.dataset.ease || EASE.out,
      clearProps: kind === 'blur' ? 'filter' : '',
      scrollTrigger: {
        trigger: node.dataset.trigger ? node.closest(node.dataset.trigger) || node : node,
        start: node.dataset.start || 'top 84%',
        once: node.dataset.once !== 'false',
        toggleActions: node.dataset.once === 'false' ? 'play reverse play reverse' : 'play none none none',
      },
    })
  })
}

/* ------------------------------------------------------------------------ */
/*  GROUPED / STAGGERED REVEALS                                              */
/* ------------------------------------------------------------------------ */

function revealGroups(root) {
  qsa('[data-reveal-group]', root).forEach((group) => {
    if (DONE.has(group)) return
    DONE.add(group)

    const selector = group.dataset.revealGroup || ':scope > *'
    const items = qsa(selector, group)
    if (!items.length) return

    const kind = group.dataset.revealKind || 'up'
    const from = FROM[kind] || FROM.up
    const to = TO[kind] || { opacity: 1, x: 0, y: 0, scale: 1 }

    gsap.set(items, from)
    gsap.to(items, {
      ...to,
      duration: dataNum(group, 'duration', DUR.slow),
      delay: dataNum(group, 'delay', 0),
      stagger: dataNum(group, 'stagger', 0.075),
      ease: group.dataset.ease || EASE.out,
      scrollTrigger: {
        trigger: group,
        start: group.dataset.start || 'top 82%',
        once: true,
      },
    })
  })
}

/* ------------------------------------------------------------------------ */
/*  TEXT REVEALS                                                             */
/* ------------------------------------------------------------------------ */

function revealText(root) {
  qsa('[data-split]', root).forEach((node) => {
    if (DONE.has(node)) return
    DONE.add(node)

    const mode = node.dataset.split || 'lines'
    const stagger = dataNum(node, 'stagger', mode === 'chars' ? 0.018 : mode === 'words' ? 0.035 : 0.09)
    const delay = dataNum(node, 'delay', 0)
    const start = node.dataset.start || 'top 86%'

    const build = () => {
      const type = mode === 'chars' ? 'lines,words,chars' : mode === 'words' ? 'lines,words' : 'lines'
      const split = splitText(node, { type, mask: mode === 'lines' ? 'lines' : 'words' })
      if (!split) return
      const targets = mode === 'chars' ? split.chars : mode === 'words' ? split.words : split.lines

      gsap.set(node, { visibility: 'visible' })
      gsap.fromTo(
        targets,
        { yPercent: 118, opacity: mode === 'chars' ? 0 : 1, rotate: mode === 'lines' ? 2 : 0 },
        {
          yPercent: 0,
          opacity: 1,
          rotate: 0,
          duration: mode === 'chars' ? 0.85 : 1.15,
          ease: EASE.out,
          stagger: mode === 'chars' ? { each: stagger, from: 'start' } : stagger,
          delay,
          scrollTrigger: { trigger: node, start, once: true },
        }
      )
    }

    // Wait for webfonts so the split measures real glyph metrics.
    if (document.fonts?.status === 'loaded') build()
    else document.fonts.ready.then(build)
  })
}

/* ------------------------------------------------------------------------ */
/*  PARALLAX                                                                 */
/* ------------------------------------------------------------------------ */

function parallax(root) {
  qsa('[data-parallax], [data-parallax-x], [data-parallax-scale]', root).forEach((node) => {
    if (DONE.has(node)) return
    DONE.add(node)

    const y = dataNum(node, 'parallax', 0)
    const x = dataNum(node, 'parallaxX', 0)
    const scaleTo = dataNum(node, 'parallaxScale', 0)
    const scope = node.dataset.parallaxScope
    const trigger = scope ? node.closest(scope) || node : node.parentElement || node

    const vars = { ease: 'none' }
    if (y) vars.yPercent = y * 100
    if (x) vars.xPercent = x * 100
    if (scaleTo) vars.scale = scaleTo

    gsap.fromTo(
      node,
      scaleTo ? { scale: 1 } : {},
      {
        ...vars,
        scrollTrigger: {
          trigger,
          start: node.dataset.parallaxStart || 'top bottom',
          end: node.dataset.parallaxEnd || 'bottom top',
          scrub: dataNum(node, 'parallaxScrub', 1),
          invalidateOnRefresh: true,
        },
      }
    )
  })
}

/* ------------------------------------------------------------------------ */
/*  MEDIA REVEAL — frame unmasks while its inner art scales back to rest     */
/* ------------------------------------------------------------------------ */

function revealMedia(root) {
  qsa('[data-media-reveal]', root).forEach((node) => {
    if (DONE.has(node)) return
    DONE.add(node)

    const inner = node.firstElementChild
    const dir = node.dataset.mediaReveal || 'up'
    const clipFrom =
      dir === 'left' ? 'inset(0 100% 0 0)' :
      dir === 'right' ? 'inset(0 0 0 100%)' :
      dir === 'down' ? 'inset(0 0 100% 0)' :
      'inset(100% 0 0 0)'

    const tl = gsap.timeline({
      scrollTrigger: { trigger: node, start: node.dataset.start || 'top 85%', once: true },
    })
    tl.fromTo(node, { clipPath: clipFrom }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: EASE.out })
    if (inner) {
      tl.fromTo(inner, { scale: 1.34 }, { scale: 1, duration: 1.8, ease: EASE.out }, 0)
    }
  })
}

/* ------------------------------------------------------------------------ */
/*  NUMBER COUNTERS                                                          */
/* ------------------------------------------------------------------------ */

function counters(root) {
  qsa('[data-counter]', root).forEach((node) => {
    if (DONE.has(node)) return
    DONE.add(node)

    const end = dataNum(node, 'counter', 0)
    const decimals = dataNum(node, 'decimals', 0)
    const prefix = node.dataset.prefix || ''
    const suffix = node.dataset.suffix || ''
    const obj = { v: dataNum(node, 'from', 0) }

    node.textContent = prefix + obj.v.toFixed(decimals) + suffix

    gsap.to(obj, {
      v: end,
      duration: dataNum(node, 'duration', 2.1),
      ease: 'power2.out',
      snap: decimals ? { v: 1 / 10 ** decimals } : { v: 1 },
      onUpdate() {
        node.textContent =
          prefix +
          obj.v.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }) +
          suffix
      },
      scrollTrigger: { trigger: node, start: 'top 90%', once: true },
    })
  })
}

/* ------------------------------------------------------------------------ */
/*  SVG STROKE DRAW-ON                                                       */
/* ------------------------------------------------------------------------ */

function drawSvg(root) {
  qsa('[data-draw]', root).forEach((node) => {
    if (DONE.has(node)) return
    DONE.add(node)

    const strokes = qsa('path, line, circle, rect, polyline, polygon, ellipse', node)
    if (!strokes.length) return

    gsap.fromTo(
      strokes,
      { drawSVG: '0%' },
      {
        drawSVG: '100%',
        duration: dataNum(node, 'duration', 1.6),
        stagger: dataNum(node, 'stagger', 0.045),
        ease: EASE.soft,
        scrollTrigger: { trigger: node, start: node.dataset.start || 'top 85%', once: true },
      }
    )
  })
}

/* ------------------------------------------------------------------------ */
/*  VELOCITY SKEW — subtle bend on fast scroll, the classic premium touch    */
/* ------------------------------------------------------------------------ */

let skewNodes = []
let skewRunning = false

function initSkew(root) {
  const found = qsa('[data-skew]', root)
  if (!found.length) return
  skewNodes = skewNodes.concat(found)
  if (skewRunning) return
  skewRunning = true

  const setters = new WeakMap()
  let current = 0

  gsap.ticker.add(() => {
    const target = clamp(scrollVelocity() * 0.0055, -6, 6)
    current += (target - current) * 0.1
    if (Math.abs(current) < 0.006 && Math.abs(target) < 0.006) return
    for (const node of skewNodes) {
      let set = setters.get(node)
      if (!set) {
        set = gsap.quickSetter(node, 'skewY', 'deg')
        setters.set(node, set)
      }
      set(current * dataNum(node, 'skew', 1))
    }
  })
}

/* ------------------------------------------------------------------------ */
/*  HOVER LIFT — declarative micro-interaction for cards                     */
/* ------------------------------------------------------------------------ */

function hoverLift(root) {
  if (window.matchMedia('(hover: none)').matches) return
  qsa('[data-lift]', root).forEach((node) => {
    if (DONE.has(node)) return
    DONE.add(node)
    const amount = dataNum(node, 'lift', 8)
    const q = gsap.quickTo(node, 'y', { duration: 0.5, ease: EASE.out })
    node.addEventListener('pointerenter', () => q(-amount))
    node.addEventListener('pointerleave', () => q(0))
  })
}

/* ------------------------------------------------------------------------ */
/*  PUBLIC                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Scan a subtree and wire up every declarative animation it declares.
 * Safe to call repeatedly — already-initialised nodes are skipped.
 */
export function initReveals(root = document) {
  if (prefersReducedMotion()) {
    qsa('[data-reveal], [data-split], [data-media-reveal]', root).forEach((n) => {
      gsap.set(n, { clearProps: 'all' })
      n.style.visibility = 'visible'
    })
    counters(root)
    return
  }

  revealElements(root)
  revealGroups(root)
  revealText(root)
  parallax(root)
  revealMedia(root)
  counters(root)
  drawSvg(root)
  initSkew(root)
  hoverLift(root)

  ScrollTrigger.refresh()
}

export { FROM as REVEAL_FROM }
