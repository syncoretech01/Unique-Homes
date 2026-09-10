/* ============================================================================
   STORY — pinned parallax narrative
   ----------------------------------------------------------------------------
   SITE → DRAWINGS → STRUCTURE → RENDER → BUILT.

   Desktop (≥ 901px and a tall enough viewport): one 100svh stage is pinned for
   ~4.2 further viewports. Five depth layers scrub at four different rates —
   contour wash (slowest), site/framing plan, drawing sheets, setting-out grid
   (fastest) — while the text column rolls one beat out and the next in.

   Everything else — narrow, short, reduced motion, no JS — reads as a plain
   vertical sequence with a drawing above each beat. The markup is authored for
   that case, so nothing here is load-bearing for legibility.
   ========================================================================== */
import './story.css'
import { gsap, ScrollTrigger, EASE, sceneTimeline } from '../../core/motion.js'
import { qs, qsa, clamp } from '../../lib/utils.js'
import { drawingSVG } from '../../lib/drawings.js'

/* Scroll length of the pin, in viewport heights, after the stage locks. */
const SCROLL_VH = 4.2

/* Timeline units: five beats of 20, transitions 8 units wide and centred on
   each beat boundary. */
const SEG = 20
const TRANS = 8
const TOTAL = SEG * 5
const at = (i) => i * SEG

/* Drawing ink strengths, expressed against the section's own tokens so the
   line work flips with the theme. Fallbacks match data-theme="ink". */
const TONE = {
  soft: ['color-mix(in oklab, var(--fg) 50%, var(--bg))', '#7E776B'],
  mid: ['color-mix(in oklab, var(--fg) 70%, var(--bg))', '#ABA498'],
  ink: ['color-mix(in oklab, var(--fg) 88%, var(--bg))', '#DDD6C9'],
}

/* Sheet choreography — one state per beat. Values are offsets from the base
   position each sheet is given in CSS. */
const SHEETS = [
  [
    { xPercent: 30, yPercent: 28, rotation: 7, scale: 0.86, opacity: 0 },
    { xPercent: 0, yPercent: 0, rotation: -2.2, scale: 1, opacity: 1 },
    { xPercent: -8, yPercent: -7, rotation: -4.6, scale: 0.95, opacity: 0.4 },
    { xPercent: -16, yPercent: -13, rotation: -6.4, scale: 0.9, opacity: 0.16 },
    { xPercent: -12, yPercent: -10, rotation: -3.4, scale: 0.92, opacity: 0.24 },
  ],
  [
    { xPercent: 36, yPercent: 34, rotation: 9, scale: 0.84, opacity: 0 },
    { xPercent: 2, yPercent: 3, rotation: 2.8, scale: 1, opacity: 0.96 },
    { xPercent: -6, yPercent: -3, rotation: 1.2, scale: 0.97, opacity: 0.48 },
    { xPercent: -15, yPercent: -11, rotation: 4.4, scale: 0.9, opacity: 0.18 },
    { xPercent: -10, yPercent: -7, rotation: 2.2, scale: 0.92, opacity: 0.28 },
  ],
  [
    { xPercent: 44, yPercent: 42, rotation: -10, scale: 0.78, opacity: 0 },
    { xPercent: 10, yPercent: 9, rotation: -4.5, scale: 0.92, opacity: 0.55 },
    { xPercent: -4, yPercent: -4, rotation: -1.4, scale: 1.1, opacity: 1 },
    { xPercent: -20, yPercent: 5, rotation: -5.6, scale: 0.9, opacity: 0.22 },
    { xPercent: -14, yPercent: 2, rotation: -2.6, scale: 0.92, opacity: 0.32 },
  ],
  [
    { xPercent: 16, yPercent: 48, rotation: 5, scale: 0.78, opacity: 0 },
    { xPercent: 12, yPercent: 32, rotation: 3.4, scale: 0.84, opacity: 0 },
    { xPercent: 8, yPercent: 20, rotation: 1.8, scale: 0.9, opacity: 0.14 },
    { xPercent: 0, yPercent: 0, rotation: -1, scale: 1, opacity: 1 },
    { xPercent: -2, yPercent: -5, rotation: 0, scale: 1.05, opacity: 1 },
  ],
]

/* Opacity arcs for the flat layers. */
const FADES = [
  ['.story__art--site', [1, 0.85, 0.14, 0.06, 0.05]],
  ['.story__art--framing', [0, 0.3, 1, 0.34, 0.16]],
  ['.story__layer--wash', [0.55, 0.4, 0.3, 0.22, 0.32]],
  ['.story__layer--marks', [0.3, 0.36, 0.3, 0.15, 0.06]],
  ['.story__glow', [0, 0, 0.08, 0.62, 0.34]],
]

export default function initStory(ctx) {
  const root = document.querySelector('[data-section="story"]')
  if (!root) return

  const viewport = qs('.story__viewport', root)
  const beatsEl = qs('.story__beats', root)
  const beats = qsa('.story__beat', root)
  if (!viewport || !beatsEl || beats.length !== 5) return

  const railStops = qsa('.story__rail-stop', root)
  const railFill = qs('.story__rail-fill', root)
  const tickBtns = qsa('.story__tick-btn', root)
  const tickFills = qsa('.story__tick-fill', root)
  const layerArt = qsa('.story__layers [data-art]', root)
  const figArt = qsa('.story__fig-art[data-art]', root)

  const colors = resolveColors(root)

  /* --------------------------------------------------- lazy art mounting */
  let near = false
  const queued = []
  const runQueued = () => {
    near = true
    while (queued.length) {
      try {
        queued.shift()()
      } catch (err) {
        console.error('[story] art', err)
      }
    }
  }
  const whenNear = (fn) => (near ? fn() : queued.push(fn))

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        runQueued()
      },
      { rootMargin: '70% 0px 70% 0px' }
    )
    io.observe(root)
  } else {
    runQueued()
  }

  const mountAll = (nodes) => whenNear(() => nodes.forEach((n) => mountArt(n, colors)))

  /* ------------------------------------------------------- active marker */
  let active = -1
  function setActive(i) {
    if (i === active) return
    active = i
    railStops.forEach((stop, k) => {
      stop.classList.toggle('is-active', k === i)
      stop.classList.toggle('is-done', k < i)
    })
    tickBtns.forEach((btn, k) => {
      btn.classList.toggle('is-active', k === i)
      btn.classList.toggle('is-done', k < i)
      if (k === i) btn.setAttribute('aria-current', 'step')
      else btn.removeAttribute('aria-current')
    })
  }
  function clearActive() {
    active = -1
    railStops.forEach((s) => s.classList.remove('is-active', 'is-done'))
    tickBtns.forEach((b) => {
      b.classList.remove('is-active', 'is-done')
      b.removeAttribute('aria-current')
    })
  }

  /* --------------------------------------------------- timeline jump-to's */
  let pinST = null

  const scrollToY = (y) => {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const target = Math.round(clamp(y, 0, max))
    if (ctx.lenis && typeof ctx.lenis.scrollTo === 'function') {
      ctx.lenis.scrollTo(target, { duration: 1.15 })
    } else {
      window.scrollTo({ top: target, behavior: ctx.reduced ? 'auto' : 'smooth' })
    }
  }

  tickBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (pinST) {
        // land in the settled middle of the requested beat
        scrollToY(pinST.start + (pinST.end - pinST.start) * (i * 0.2 + 0.1))
        return
      }
      const beat = beats[i]
      if (!beat) return
      const top = beat.getBoundingClientRect().top + window.scrollY
      scrollToY(top - window.innerHeight * 0.18)
    })
  })

  /* -------------------------------------------------------- intro reveal */
  if (!ctx.reduced) {
    const introLines = qsa('.story__title .story__ln > span', root)
    const eyebrow = qs('.story__head .eyebrow', root)
    const lede = qs('.story__lede', root)
    const tl = sceneTimeline(qs('.story__head', root), { start: 'top 84%' })
    if (eyebrow) tl.from(eyebrow, { opacity: 0, x: -18, duration: 0.8 }, 0)
    if (introLines.length) {
      tl.from(introLines, { yPercent: 125, duration: 1.05, ease: EASE.out, stagger: 0.09 }, 0.06)
    }
    if (lede) tl.from(lede, { opacity: 0, y: 18, duration: 0.9 }, 0.3)
  }

  /* --------------------------------------- reduced motion: static reading */
  if (ctx.reduced) {
    mountAll(figArt)
    return
  }

  /* ============================================================ SCENES == */
  const mm = gsap.matchMedia()

  mm.add(
    {
      pinned: '(min-width: 901px) and (min-height: 600px)',
      stacked: '(max-width: 900px), (max-height: 599px)',
    },
    (context) => (context.conditions.pinned ? buildPinned() : buildStacked())
  )

  /* ------------------------------------------------------------ PINNED -- */
  function buildPinned() {
    root.classList.add('is-pinned')
    mountAll(layerArt)

    const q = (sel) => qs(sel, root)

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: viewport,
        start: 'top top',
        end: () => '+=' + Math.round(window.innerHeight * SCROLL_VH),
        pin: viewport,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: 0.65,
        onUpdate: (self) => setActive(clamp(Math.floor(self.progress * 5), 0, 4)),
      },
    })
    pinST = tl.scrollTrigger

    /* spine — fixes the timeline's overall length at TOTAL units */
    tl.to({ v: 0 }, { v: 1, duration: TOTAL }, 0)

    /* ---- four distinct parallax rates, back to front ------------------- */
    const drift = (sel, from, to) => {
      const node = q(sel)
      if (node) tl.fromTo(node, from, { ...to, duration: TOTAL }, 0)
    }
    drift('.story__layer--wash', { yPercent: -2.6, scale: 1.08 }, { yPercent: 2.6, scale: 1 })
    drift('.story__layer--mid', { yPercent: -7, xPercent: 1.4 }, { yPercent: 7, xPercent: -1.4 })
    drift('.story__layer--glow', { yPercent: -4 }, { yPercent: 4 })
    drift('.story__layer--sheets', { yPercent: -10, xPercent: -1.6 }, { yPercent: 10, xPercent: 1.6 })
    drift('.story__layer--marks', { yPercent: -14, xPercent: 2.4 }, { yPercent: 14, xPercent: -2.4 })

    /* ---- per-beat states ----------------------------------------------- */
    const keyframe = (node, states) => {
      if (!node) return
      gsap.set(node, states[0])
      for (let i = 1; i < 5; i++) {
        tl.to(node, { ...states[i], duration: TRANS, ease: 'power2.inOut' }, at(i) - TRANS / 2)
      }
    }

    SHEETS.forEach((states, i) => keyframe(q(`.story__sheet[data-sheet="${i}"]`), states))
    FADES.forEach(([sel, values]) => keyframe(q(sel), values.map((opacity) => ({ opacity }))))

    /* ---- the approval stamp lands on the last beat --------------------- */
    const stamp = q('.story__stamp')
    if (stamp) {
      gsap.set(stamp, { opacity: 0, scale: 0.82, rotation: -13 })
      tl.to(
        stamp,
        { opacity: 1, scale: 1, rotation: -7, duration: TRANS * 0.9, ease: 'back.out(1.7)' },
        at(4) - TRANS / 2
      )
    }

    /* ---- text: one beat rolls out as the next rolls in ----------------- */
    const lines = beats.map((b) => qsa('.story__ln > span', b))
    const nums = beats.map((b) => qs('.story__num', b))

    lines.forEach((set, i) => gsap.set(set, { yPercent: i === 0 ? 0 : 125 }))
    nums.forEach((n, i) => n && gsap.set(n, { opacity: i === 0 ? 1 : 0, yPercent: i === 0 ? 0 : 24 }))

    for (let i = 1; i < 5; i++) {
      const t = at(i) - TRANS / 2
      tl.to(lines[i - 1], { yPercent: -125, duration: TRANS, ease: 'power2.inOut', stagger: 0.5 }, t)
      tl.to(lines[i], { yPercent: 0, duration: TRANS, ease: 'power2.inOut', stagger: 0.5 }, t)
      if (nums[i - 1]) {
        tl.to(nums[i - 1], { opacity: 0, yPercent: -24, duration: TRANS * 0.55, ease: 'power2.in' }, t)
      }
      if (nums[i]) {
        tl.to(nums[i], { opacity: 1, yPercent: 0, duration: TRANS * 0.7, ease: 'power2.out' }, t + TRANS * 0.28)
      }
    }

    /* ---- rail + bottom timeline ---------------------------------------- */
    if (railFill) {
      gsap.set(railFill, { scaleY: 0 })
      tl.to(railFill, { scaleY: 1, duration: TOTAL }, 0)
    }
    gsap.set(tickFills, { scaleX: 0 })
    tickFills.forEach((fill, i) => tl.to(fill, { scaleX: 1, duration: SEG }, at(i)))

    setActive(0)

    return () => {
      root.classList.remove('is-pinned')
      pinST = null
      clearActive()
    }
  }

  /* ----------------------------------------------------------- STACKED -- */
  function buildStacked() {
    root.classList.remove('is-pinned')
    mountAll(figArt)

    gsap.set(tickFills, { scaleX: 0 })
    if (railFill) gsap.set(railFill, { scaleY: 0 })

    beats.forEach((beat, i) => {
      const lines = qsa('.story__ln > span', beat)
      const fig = qs('.story__fig', beat)
      const art = qs('.story__fig-art', beat)
      const num = qs('.story__num', beat)

      gsap.set(lines, { yPercent: 0 })
      if (num) gsap.set(num, { opacity: 1, yPercent: 0 })

      const enter = gsap.timeline({
        defaults: { ease: EASE.out },
        scrollTrigger: { trigger: beat, start: 'top 82%', once: true },
      })
      if (fig) enter.from(fig, { opacity: 0, yPercent: 5, duration: 1.1 }, 0)
      if (num) enter.from(num, { opacity: 0, yPercent: 34, duration: 1 }, 0.12)
      enter.from(lines, { yPercent: 125, duration: 1, stagger: 0.08 }, 0.18)

      if (art) {
        gsap.fromTo(
          art,
          { yPercent: -5 },
          {
            yPercent: 5,
            ease: 'none',
            scrollTrigger: { trigger: beat, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
          }
        )
      }

      if (tickFills[i]) {
        gsap.fromTo(
          tickFills[i],
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: { trigger: beat, start: 'top 74%', end: 'bottom 56%', scrub: 0.5 },
          }
        )
      }
    })

    ScrollTrigger.create({
      trigger: beatsEl,
      start: 'top 72%',
      end: 'bottom 42%',
      onUpdate: (self) => setActive(clamp(Math.floor(self.progress * 5), 0, 4)),
    })

    return () => {
      clearActive()
    }
  }
}

/* ========================================================================= */
/*  HELPERS                                                                  */
/* ========================================================================= */

/**
 * Resolve the section's token-driven colours to concrete rgb() strings that
 * the SVG generator can use. A throwaway probe inside the themed scope means
 * the values follow data-theme rather than being hard-coded here.
 */
function resolveColors(root) {
  const out = { soft: TONE.soft[1], mid: TONE.mid[1], ink: TONE.ink[1], accent: '#CF6E42' }
  let probe = null
  try {
    probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:absolute;left:-9999px;top:0;width:0;height:0;opacity:0;pointer-events:none'
    root.appendChild(probe)

    const read = (value, fallback) => {
      probe.style.color = ''
      probe.style.color = value
      const c = getComputedStyle(probe).color
      return c && c !== 'rgba(0, 0, 0, 0)' ? c : fallback
    }

    out.soft = read(TONE.soft[0], out.soft)
    out.mid = read(TONE.mid[0], out.mid)
    out.ink = read(TONE.ink[0], out.ink)
    out.accent = read('var(--accent)', out.accent)
  } catch {
    /* keep the ink-theme fallbacks */
  } finally {
    if (probe && probe.parentNode) probe.parentNode.removeChild(probe)
  }
  return out
}

/** Render one procedural drawing into its holder, once. */
function mountArt(node, colors) {
  if (!node || node.dataset.mounted === '1') return
  node.dataset.mounted = '1'
  const num = (name, fallback) => {
    const v = parseFloat(node.dataset[name])
    return Number.isFinite(v) ? v : fallback
  }
  node.innerHTML = drawingSVG(node.dataset.art || 'grid', {
    seed: num('seed', 1),
    ink: colors[node.dataset.tone] || colors.mid,
    accent: colors.accent,
    width: num('w', 1200),
    height: num('h', 800),
    density: num('density', 1),
    strokeScale: num('stroke', 1),
    showTitleBlock: false,
  })
}
